"""
BioAttend fingerprint bridge.

A small local HTTP service that owns the fingerprint reader and exposes it to
the browser. Needed because the device enumerates as USB mass storage rather
than a serial port, so no browser API can reach it directly.

    Browser ──HTTP──▶ localhost:8321 ──ctypes──▶ fpsapit.dll ──SCSI──▶ Reader

Standard library only — no pip install. Run it with 32-bit Python:

    py -3-32 bioattend_bridge.py

Security notes:
  * Binds to 127.0.0.1 only. Not reachable from the network.
  * CORS is restricted to the origins in ALLOWED_ORIGINS.
  * It captures fingerprints; it does not decide attendance. All authority
    stays in Supabase, where the kiosk credential and shift windows are
    enforced. A compromised bridge cannot forge a check-in.
"""

from __future__ import annotations

import base64
import json
import math
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Optional

from zaz import BUFFER_A, BUFFER_B, ZazError, ZazReader, describe

HOST = "127.0.0.1"
PORT = 8321

# Origins permitted to call this bridge.
#
# Add your deployed site here. The bridge runs on the kiosk PC while the page
# is served from Vercel, so the browser treats every call as cross-origin and
# will block it unless the origin is listed.
ALLOWED_ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    # --- deployed site ---
    "https://bio-attend-one.vercel.app",
}

# Vercel gives every deployment its own preview URL. Rather than listing them
# individually, any https origin under these suffixes is accepted.
ALLOWED_ORIGIN_SUFFIXES = (".vercel.app",)


def origin_allowed(origin: str) -> bool:
    if origin in ALLOWED_ORIGINS:
        return True
    if not origin.startswith("https://"):
        return False
    host = origin[len("https://"):]
    return host.endswith(ALLOWED_ORIGIN_SUFFIXES)

# Device type 2 = USB mass-storage transport, confirmed against this hardware
# (LIROX, sensor 781102). Set to None to re-run discovery on a different unit.
KNOWN_DEVICE_TYPE: Optional[int] = 2

_reader: Optional[ZazReader] = None
_lock = threading.Lock()  # the DLL is not thread-safe


def reader() -> ZazReader:
    global _reader
    if _reader is None:
        _reader = ZazReader()
    return _reader


# ---------------------------------------------------------------------------
# Capture helpers
# ---------------------------------------------------------------------------

class ReaderUnavailable(RuntimeError):
    """The reader cannot be used at all — unplugged, or held by another program.

    Distinct from a poor press: the kiosk must never count this as a failed
    fingerprint attempt, because nobody touched anything.
    """


# Consecutive device errors, with no finger seen, before the reader is
# declared unavailable rather than merely noisy (~3 s of polling).
MAX_IDLE_ERRORS = 30


def ensure_open(dev: ZazReader) -> None:
    """
    Open the reader if it is not already open.

    The reader used to be opened only from the Devices page, so after the
    bridge restarted — a reboot, a closed window — every scan failed with
    "device not open" until someone found that page. The kiosk read each of
    those failures as a bad press and counted attempts with nobody there.
    """
    if dev.is_open:
        return
    if KNOWN_DEVICE_TYPE is None:
        raise ReaderUnavailable("The reader has not been set up. Connect it from Devices.")
    try:
        dev.open(KNOWN_DEVICE_TYPE)
    except Exception as err:  # noqa: BLE001
        raise ReaderUnavailable(
            "The fingerprint reader is not connected. Check the USB cable, and close "
            f"fpdemo.exe if it is open. ({err})"
        ) from err


# ---------------------------------------------------------------------------
# Is there really a finger on the sensor?
#
# Measured on this reader (bridge/diag_image.py): after power-up it answers
# GetImage with SUCCESS while the sensor is EMPTY, returning a blank white
# frame — and keeps doing so until a real finger has been pressed once. Taken
# at its word, every blank frame became a "too few features" press and the
# kiosk counted 1, 2, 3 with nobody there.
#
# So the frame itself decides. Share of dark pixels (value < 128):
#     empty sensor (phantom frame)   0.02 - 0.03
#     finger landing / half down     ~0.14
#     finger pressed flat            0.63 - 0.84
# A frame below FINGER_DARK_MIN is treated as no finger, whatever the code.
# ---------------------------------------------------------------------------
FINGER_DARK_MIN = 0.25
_DARK = bytes(1 if value < 128 else 0 for value in range(256))


def dark_fraction(image: bytes) -> float:
    return sum(image.translate(_DARK)) / len(image) if image else 0.0


def sense(dev: ZazReader) -> tuple[str, int]:
    """
    One look at the sensor. Returns ("finger", 0), ("empty", 0) or
    ("error", code). On "finger" the frame is still in the image buffer,
    ready for GenChar.
    """
    code = dev.get_image()
    if code == 0x02:
        return "empty", 0
    if code != 0:
        return "error", code
    try:
        image = dev.up_image()
    except ZazError as err:
        return "error", err.code
    return ("finger", 0) if dark_fraction(image) >= FINGER_DARK_MIN else ("empty", 0)


# A finger must be seen in this many consecutive frames before it counts, so
# one odd frame (a leftover image in the module's buffer) is never a press.
FINGER_FRAMES = 2


def wait_for_finger(dev: ZazReader, timeout_s: float = 15.0, require_clear: bool = True) -> None:
    """
    Poll until a real finger is on the sensor.

    With `require_clear`, the sensor must first be seen EMPTY. A new press is
    a finger arriving, not one already there: this stops a frame left in the
    module's buffer — the previous person's finger — or a finger that never
    lifted from being read as a fresh press.

    Blank frames and stray device codes while nobody is there are polled
    through. Only a sustained run of errors — a reader that has stopped
    answering — is reported, and as unavailable rather than as a press.
    """
    deadline = time.time() + timeout_s
    errors = 0
    seen_empty = not require_clear
    streak = 0
    while time.time() < deadline:
        state, code = sense(dev)
        if state == "finger" and seen_empty:
            streak += 1
            if streak >= FINGER_FRAMES:
                return
            time.sleep(0.05)
            continue
        streak = 0
        if state == "empty":
            errors = 0
            seen_empty = True
        elif state == "finger":
            errors = 0  # present but not yet cleared since the last press
        else:
            errors += 1
            if errors >= MAX_IDLE_ERRORS:
                dev.close()  # reopened automatically on the next request
                raise ReaderUnavailable(f"The fingerprint reader stopped responding ({describe(code)}).")
        time.sleep(0.1)
    raise TimeoutError("Timed out waiting for a finger.")


# Codes that describe a poor image rather than a broken device: the finger
# was only half down, moving, smudged or dry. Retaking the image while the
# finger stays on the sensor usually clears them.
RETRYABLE_CAPTURE_CODES = {0x03, 0x06, 0x07, 0x15}

# Pause after the first touch so the finger can flatten. GetImage succeeds the
# moment anything touches the glass, which is usually just the tip — an image
# with too few ridges, reported as 0x07 "too few features".
SETTLE_S = 0.35
CAPTURE_TRIES = 6
RETRY_GAP_S = 0.2


def capture_features(dev: ZazReader, buffer_id: int, timeout_s: float = 15.0) -> None:
    """
    Wait for a finger, let it settle, and extract features into `buffer_id`.

    One press gets several tries: a frame that yields too few features is
    simply retaken while the finger is still down, instead of failing the
    press and making the person start again.
    """
    deadline = time.time() + timeout_s
    wait_for_finger(dev, timeout_s)
    time.sleep(SETTLE_S)

    last_error: Optional[ZazError] = None
    for _ in range(CAPTURE_TRIES):
        state, code = sense(dev)
        if state == "empty":
            # Lifted mid-capture, or a blank frame. Wait for a real finger
            # rather than fail — a blank frame is never anyone's press.
            remaining = deadline - time.time()
            if remaining <= 0:
                break
            wait_for_finger(dev, remaining, require_clear=False)  # it was just seen empty
            time.sleep(SETTLE_S)
            continue
        if state == "error":
            last_error = ZazError(code, "Capture image")
            if code not in RETRYABLE_CAPTURE_CODES:
                raise last_error
            time.sleep(RETRY_GAP_S)
            continue
        try:
            dev.gen_char(buffer_id)
            return
        except ZazError as err:
            if err.code not in RETRYABLE_CAPTURE_CODES:
                raise
            last_error = err
            time.sleep(RETRY_GAP_S)

    if last_error is not None:
        raise last_error
    raise TimeoutError("Timed out waiting for a finger.")


def wait_for_removal(dev: ZazReader, timeout_s: float = 10.0) -> None:
    """Return once the finger is off — a blank frame counts as off, too."""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if sense(dev)[0] == "empty":
            return
        time.sleep(0.1)


def estimate_quality(template: bytes) -> int:
    """
    Rough 0-100 quality score from template entropy.

    The module exposes no NFIQ value, so this approximates one: a template
    dominated by repeated or zero bytes carries less distinguishing
    information. Good enough to reject obviously poor captures. It is NOT
    NFIQ and should not be described as such in the write-up.
    """
    if not template:
        return 0
    histogram = [0] * 256
    for byte in template:
        histogram[byte] += 1
    entropy = 0.0
    for count in histogram:
        if count:
            p = count / len(template)
            entropy -= p * math.log2(p)
    return max(0, min(100, round(entropy / 8 * 100)))


def enroll(passes: int = 3) -> dict[str, Any]:
    """Three presses of one finger, merged into a single template."""
    dev = reader()
    for index in range(passes):
        capture_features(dev, BUFFER_A if index == 0 else BUFFER_B)
        if index < passes - 1:
            wait_for_removal(dev)

    dev.reg_module()
    template = dev.up_char(BUFFER_A)
    return {
        "template": base64.b64encode(template).decode("ascii"),
        "bytes": len(template),
        "quality": estimate_quality(template),
    }


def identify(page_count: int = 1000) -> dict[str, Any]:
    """Capture once and search the on-device library."""
    dev = reader()
    capture_features(dev, BUFFER_A)

    result = dev.high_speed_search(0, page_count, BUFFER_A)
    if result is None:
        return {"matched": False}
    page_id, score = result
    return {"matched": True, "slot": page_id, "score": score}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

def route(path: str, body: dict[str, Any]) -> dict[str, Any]:
    dev = reader()

    if path == "/health":
        return {
            "ok": True,
            "service": "bioattend-bridge",
            "connected": dev.is_open,
            "deviceType": dev.device_type,
        }

    if path == "/probe":
        # One-off discovery of the correct nDeviceType for this hardware.
        return {"workingDeviceTypes": dev.probe_device_types()}

    if path == "/connect" and dev.is_open:
        # Already open — report it rather than reopen. The Devices page asks
        # on every visit, and the kiosk may be using the reader meanwhile.
        return {
            "connected": True,
            "deviceType": dev.device_type,
            "diskNumber": dev.disk_number,
            "templateCount": dev.template_count(),
            "version": dev.read_version(),
        }

    if path == "/connect":
        device_type = body.get("deviceType", KNOWN_DEVICE_TYPE)
        if device_type is None:
            found = dev.probe_device_types()
            if not found:
                raise RuntimeError(
                    "No working device type found. Is the reader plugged in, and "
                    "is fpdemo.exe closed?"
                )
            device_type = found[0]
        dev.open(int(device_type))
        return {
            "connected": True,
            "deviceType": dev.device_type,
            "diskNumber": dev.disk_number,
            "templateCount": dev.template_count(),
            "version": dev.read_version(),
        }

    if path == "/disconnect":
        dev.close()
        return {"connected": False}

    # Everything below needs the reader. Open it here rather than relying on
    # someone having pressed Connect on the Devices page since the last restart.
    ensure_open(dev)

    if path == "/enroll":
        return enroll(int(body.get("passes", 3)))

    # --- Step-by-step enrollment ------------------------------------------
    # /enroll does all three presses inside one request, which leaves the
    # browser with nothing to display until it finishes. These let the UI
    # drive one press at a time and show real progress.

    if path == "/capture":
        buffer_id = BUFFER_A if int(body.get("buffer", 1)) == 1 else BUFFER_B
        capture_features(dev, buffer_id, float(body.get("timeout", 20)))
        return {"captured": True, "buffer": buffer_id}

    if path == "/wait-removal":
        wait_for_removal(dev, float(body.get("timeout", 15)))
        return {"removed": True}

    if path == "/merge":
        dev.reg_module()
        template = dev.up_char(BUFFER_A)
        return {
            "template": base64.b64encode(template).decode("ascii"),
            "bytes": len(template),
            "quality": estimate_quality(template),
        }

    if path == "/identify":
        return identify(int(body.get("pageCount", 1000)))

    if path == "/template-count":
        return {"count": dev.template_count()}

    if path == "/sync":
        # Rebuild the module's flash from Supabase: wipe, then write each
        # template into the slot the server assigned.
        entries = body.get("templates", [])
        dev.empty()
        written = []
        for entry in entries:
            template = base64.b64decode(entry["template"])
            slot = int(entry["slot"])
            dev.down_char(template, BUFFER_A)
            dev.store_char(slot, BUFFER_A)
            written.append(slot)
        return {"synced": len(written), "slots": written}

    raise FileNotFoundError(f"Unknown endpoint {path}")


class Handler(BaseHTTPRequestHandler):
    server_version = "BioAttendBridge/0.1"

    def _cors(self) -> None:
        origin = self.headers.get("Origin", "")
        if not origin_allowed(origin):
            return

        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

        # Chrome's Private Network Access rules: a page on the public internet
        # reaching a server on the local network must be explicitly permitted
        # by that server, or the request is blocked before it is sent. Without
        # this header the bridge is unreachable from the deployed site even
        # though it answers fine from localhost.
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
            # The browser gave up before we answered — normal when a poll
            # times out. Nothing to report and nothing to fix.
            pass

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
            self._respond(400, {"error": "Malformed JSON body"})
            return
        self._handle(body)

    def _handle(self, body: dict[str, Any]) -> None:
        path = self.path.split("?", 1)[0]

        # /health must never queue behind a capture. It is a liveness check
        # the UI polls on a timer; blocking it behind a 30-second enrollment
        # makes the app look dead and floods the log with aborted sockets.
        needs_device = path != "/health"

        try:
            if needs_device:
                # One command at a time — the DLL keeps global device state.
                with _lock:
                    result = route(path, body)
            else:
                result = route(path, body)
            self._respond(200, result)
        except FileNotFoundError as err:
            self._respond(404, {"error": str(err)})
        except ReaderUnavailable as err:
            self._respond(200, {"error": str(err), "unavailable": True})
        except ZazError as err:
            self._respond(200, {"error": str(err), "code": err.code})
        except TimeoutError as err:
            self._respond(200, {"error": str(err), "timeout": True})
        except Exception as err:  # noqa: BLE001
            self._respond(500, {"error": f"{type(err).__name__}: {err}"})

    def handle_one_request(self) -> None:
        # Swallow the noisy tracebacks a disconnecting browser produces.
        try:
            super().handle_one_request()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            self.close_connection = True

    def log_message(self, fmt: str, *args: Any) -> None:
        # Health polls every 10s would drown anything useful.
        if "/health" in self.path:
            return
        print(f"  {self.address_string()} {fmt % args}")


def main() -> None:
    print("=" * 62)
    print("  BioAttend fingerprint bridge")
    print("=" * 62)

    try:
        dev = reader()
        print(f"  DLL loaded ({dev._convention})")
        print(f"  U-disk number: {dev.get_disk_number()}")
    except Exception as err:  # noqa: BLE001
        print(f"\n  Could not load the SDK: {err}\n")
        raise SystemExit(1)

    print(f"  Listening on http://{HOST}:{PORT}")
    print("  Leave this window open while using BioAttend.")
    print("  Close fpdemo.exe — only one program can hold the reader.")
    print("=" * 62)

    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
