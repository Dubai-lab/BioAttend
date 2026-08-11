"""
BioAttend face recognition service.

Runs InsightFace (SCRFD detection + ArcFace recognition) on the kiosk machine
and exposes it to the browser over HTTP.

    Browser ──HTTP──▶ localhost:8322 ──▶ InsightFace ──▶ 512-d embedding

WHY THIS IS A LOCAL SERVICE RATHER THAN BROWSER CODE

The previous implementation computed embeddings in the browser with a
lightweight model. ArcFace is substantially more accurate — it is trained with
an angular margin loss that maximises separation between identities, which is
exactly the property that failed when a sibling matched an enrolled face — but
it is a Python library and cannot run in a browser.

The camera still belongs to the browser. Only the captured frame crosses to
this service, and only an embedding comes back. No image is stored anywhere.

WHAT THIS SERVICE DELIBERATELY DOES NOT DO

Anti-spoofing stays in the browser. InsightFace ships no presentation attack
detection, and the browser already has a working one; moving recognition here
without keeping that would trade a real defence for accuracy. The browser gates
on liveness first and only sends frames that passed.

Run with the 64-bit virtual environment:

    .venv-face\\Scripts\\python.exe face_service.py
"""

from __future__ import annotations

import base64
import io
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Optional

import numpy as np

HOST = "127.0.0.1"
PORT = 8322

ALLOWED_ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "https://bio-attend-one.vercel.app",
}
ALLOWED_ORIGIN_SUFFIXES = (".vercel.app",)


def origin_allowed(origin: str) -> bool:
    if origin in ALLOWED_ORIGINS:
        return True
    if not origin.startswith("https://"):
        return False
    return origin[len("https://"):].endswith(ALLOWED_ORIGIN_SUFFIXES)


# --- Model configuration ----------------------------------------------------
#
# buffalo_l is the full pack: SCRFD-10G for detection and ArcFace w600k_r50 for
# recognition, producing 512-dimension embeddings. Roughly 300 MB, downloaded
# once to ~/.insightface on first run.
#
# buffalo_s is a smaller alternative if the kiosk hardware struggles, at some
# cost in accuracy. Recognition quality is the entire reason for this change,
# so the larger pack is the default.
MODEL_PACK = "buffalo_l"

# 640x640 is the detector's native size. Smaller is faster but misses faces
# further from the camera, which matters at a kiosk where people stand back.
DET_SIZE = (640, 640)

# Minimum detector confidence for a face to be considered at all.
MIN_DET_SCORE = 0.5

_app = None
_lock = threading.Lock()  # onnxruntime sessions are not thread-safe
_load_error: Optional[str] = None


def get_app():
    """Load the models once, on first use."""
    global _app, _load_error
    if _app is not None:
        return _app
    if _load_error is not None:
        raise RuntimeError(_load_error)

    try:
        from insightface.app import FaceAnalysis

        app = FaceAnalysis(
            name=MODEL_PACK,
            # detection  — locate the face
            # recognition — the 512-d embedding, the reason for this service
            # landmark_3d_68 — head pose, needed so enrolment can verify that
            #                  the requested angle was actually adopted
            #
            # The pack also contains age/gender estimation, which is excluded:
            # it costs load time and inference for data this system has no use
            # for and no business collecting.
            allowed_modules=["detection", "recognition", "landmark_3d_68"],
            providers=["CPUExecutionProvider"],
        )
        app.prepare(ctx_id=-1, det_size=DET_SIZE)  # ctx_id=-1 selects CPU
        _app = app
        return _app
    except Exception as err:  # noqa: BLE001
        _load_error = f"{type(err).__name__}: {err}"
        raise


def decode_image(data_url: str) -> "np.ndarray":
    """
    Turn a browser data URL into the BGR array InsightFace expects.

    The browser sends `data:image/jpeg;base64,...` from a canvas capture.
    OpenCV works in BGR while the encoded image is RGB, hence the reversal.
    """
    import cv2

    if "," in data_url:
        data_url = data_url.split(",", 1)[1]

    raw = base64.b64decode(data_url)
    array = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)  # already BGR

    if image is None:
        raise ValueError("Could not decode the image")
    return image


def analyse(data_url: str) -> dict[str, Any]:
    """Detect one face and return its embedding."""
    app = get_app()
    image = decode_image(data_url)

    started = time.perf_counter()
    faces = app.get(image)
    elapsed_ms = round((time.perf_counter() - started) * 1000)

    if not faces:
        return {"ok": False, "reason": "no_face", "ms": elapsed_ms}

    # More than one face is refused rather than resolved. Picking the largest
    # would let someone stand behind the person being enrolled and be captured
    # instead, which is exactly the ambiguity this system exists to avoid.
    if len(faces) > 1:
        return {"ok": False, "reason": "multiple_faces", "count": len(faces), "ms": elapsed_ms}

    face = faces[0]
    if float(face.det_score) < MIN_DET_SCORE:
        return {
            "ok": False,
            "reason": "low_confidence",
            "score": round(float(face.det_score), 4),
            "ms": elapsed_ms,
        }

    # normed_embedding is L2-normalised, so cosine similarity reduces to a dot
    # product and comparisons are consistent regardless of image scale.
    embedding = face.normed_embedding.astype(float).tolist()

    box = face.bbox.astype(int).tolist()
    height, width = image.shape[:2]

    # Head pose, used by enrolment to confirm the requested angle was met.
    yaw = pitch = 0.0
    if getattr(face, "pose", None) is not None:
        pitch, yaw = float(face.pose[0]), float(face.pose[1])

    return {
        "ok": True,
        "embedding": embedding,
        "dimensions": len(embedding),
        "score": round(float(face.det_score), 4),
        "yaw": round(yaw, 1),
        "pitch": round(pitch, 1),
        # Proportion of the frame the face occupies. A very small face yields a
        # poor embedding; the caller can ask the person to move closer.
        "coverage": round(
            ((box[2] - box[0]) * (box[3] - box[1])) / float(width * height), 4
        ),
        "ms": elapsed_ms,
    }


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

def route(path: str, body: dict[str, Any]) -> dict[str, Any]:
    if path == "/health":
        return {
            "ok": True,
            "service": "bioattend-face",
            "model": MODEL_PACK,
            "loaded": _app is not None,
            "error": _load_error,
        }

    if path == "/warmup":
        get_app()
        return {"ok": True, "model": MODEL_PACK, "loaded": True}

    if path == "/embed":
        image = body.get("image")
        if not image:
            return {"ok": False, "reason": "no_image"}
        with _lock:
            return analyse(image)

    raise FileNotFoundError(f"Unknown endpoint {path}")


class Handler(BaseHTTPRequestHandler):
    server_version = "BioAttendFace/1.0"

    def _cors(self) -> None:
        origin = self.headers.get("Origin", "")
        if not origin_allowed(origin):
            return
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        # Same private network access opt-in the fingerprint bridge needs: a
        # page served over HTTPS reaching a service on the local machine.
        if self.headers.get("Access-Control-Request-Private-Network") == "true":
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def _respond(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass  # the browser gave up; nothing to do

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        self._handle({})

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b""
        try:
            body = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            self._respond(400, {"ok": False, "reason": "bad_json"})
            return
        self._handle(body)

    def _handle(self, body: dict[str, Any]) -> None:
        path = self.path.split("?", 1)[0]
        try:
            self._respond(200, route(path, body))
        except FileNotFoundError as err:
            self._respond(404, {"ok": False, "reason": str(err)})
        except Exception as err:  # noqa: BLE001
            self._respond(500, {"ok": False, "reason": f"{type(err).__name__}: {err}"})

    def handle_one_request(self) -> None:
        try:
            super().handle_one_request()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            self.close_connection = True

    def log_message(self, fmt: str, *args: Any) -> None:
        if "/health" in self.path:
            return  # polled every few seconds; would drown everything else
        print(f"  {self.address_string()} {fmt % args}")


def main() -> None:
    print("=" * 64)
    print("  BioAttend face recognition service")
    print("=" * 64)
    print(f"  Model pack: {MODEL_PACK}  (SCRFD detection + ArcFace recognition)")
    print("  Loading models — the first run downloads ~300 MB…")

    try:
        get_app()
        print("  Models loaded.")
    except Exception as err:  # noqa: BLE001
        print(f"\n  Could not load models: {err}\n")
        print("  The service will still start and report the error over /health.")

    print(f"  Listening on http://{HOST}:{PORT}")
    print("  Leave this window open while using BioAttend.")
    print("=" * 64)

    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
