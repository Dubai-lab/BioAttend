"""
BioAttend face service tunnel.

Opens a free Cloudflare quick tunnel to the face service on this PC and
publishes the tunnel's address to the project's Supabase Storage, where the
web app reads it. A phone can then use its own camera for enrolment and face
check-in without anyone typing an address into it.

    Phone ──HTTPS──▶ Cloudflare ──▶ this PC :8322 ──▶ face_service.py

WHY THE ADDRESS IS PUBLISHED RATHER THAN CONFIGURED

A quick tunnel is given a new random address every time it starts. Baking it
into the site would mean a redeploy per restart, and typing it into each phone
is exactly the step people get wrong. So this script writes the current
address to one small public file and removes it again on exit.

The file holds an address and a timestamp, nothing else. It is public in the
same sense the tunnel itself is: anyone who finds it can send images to the
face service while this window is open, and can read nothing back but an
embedding of the image they sent. Close the window when you are finished.

A quick tunnel loses its address when the network drops and never gets it
back, so the address is checked every 30 seconds and the tunnel is reopened
and republished when it stops answering.

Standard library only. Run with run-face-tunnel.bat.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

LOCAL_SERVICE = "http://127.0.0.1:8322"
BUCKET = "bioattend-runtime"
OBJECT = "face-service.json"

HERE = Path(__file__).resolve().parent
ENV_FILE = HERE.parent / ".env.local"

TUNNEL_URL = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")


def read_env() -> dict[str, str]:
    """The Supabase URL and service role key, from the project's .env.local."""
    values: dict[str, str] = {}
    if not ENV_FILE.exists():
        return values
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip().strip("\"'")
    return values


def find_cloudflared() -> str | None:
    found = shutil.which("cloudflared")
    if found:
        return found
    for base in (os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles")):
        if base:
            candidate = Path(base) / "cloudflared" / "cloudflared.exe"
            if candidate.exists():
                return str(candidate)
    return None


class Publisher:
    """Writes the tunnel address where the web app can find it."""

    def __init__(self, supabase_url: str, service_key: str) -> None:
        self.base = supabase_url.rstrip("/") + "/storage/v1"
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        }

    def _request(self, method: str, path: str, body: bytes, extra: dict[str, str]) -> int:
        request = urllib.request.Request(
            self.base + path, data=body, method=method, headers={**self.headers, **extra}
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return response.status
        except urllib.error.HTTPError as err:
            return err.code

    def ensure_bucket(self) -> None:
        # 409 means it already exists, which is the normal case after first run.
        body = json.dumps({"id": BUCKET, "name": BUCKET, "public": True}).encode()
        status = self._request("POST", "/bucket", body, {"Content-Type": "application/json"})
        if status not in (200, 400, 409):
            raise RuntimeError(f"could not create the storage bucket (HTTP {status})")

    def publish(self, url: str | None) -> None:
        body = json.dumps(
            {"url": url, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        ).encode()
        status = self._request(
            "POST",
            f"/object/{BUCKET}/{OBJECT}",
            body,
            {
                "Content-Type": "application/json",
                # The address changes on every start; a cached copy is a dead one.
                "Cache-Control": "no-cache",
                "x-upsert": "true",
            },
        )
        if status != 200:
            raise RuntimeError(f"could not publish the address (HTTP {status})")


def service_running() -> bool:
    try:
        request = urllib.request.Request(LOCAL_SERVICE + "/health", data=b"{}", method="POST")
        with urllib.request.urlopen(request, timeout=3):
            return True
    except Exception:  # noqa: BLE001
        return False


# How often the public address is checked, and how many misses in a row
# count as a dead tunnel. A quick tunnel does not recover its address after the
# network drops — the process keeps running while the address stops existing —
# so the only cure is a new tunnel.
CHECK_EVERY_SECONDS = 30
MISSES_BEFORE_RESTART = 3
URL_WAIT_SECONDS = 60


def tunnel_answers(url: str) -> bool:
    try:
        request = urllib.request.Request(url + "/health", data=b"{}", method="POST")
        with urllib.request.urlopen(request, timeout=15):
            return True
    except Exception:  # noqa: BLE001
        return False


def start_tunnel(cloudflared: str) -> tuple[subprocess.Popen, str | None]:
    """Start cloudflared and wait for it to print its public address."""
    process = subprocess.Popen(
        [cloudflared, "tunnel", "--url", LOCAL_SERVICE, "--no-autoupdate"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    found: list[str] = []

    def read() -> None:
        # Keeps draining output for the life of the process, or a full pipe
        # would eventually stall cloudflared.
        assert process.stdout is not None
        for line in process.stdout:
            match = TUNNEL_URL.search(line)
            if match and not found:
                found.append(match.group(0))

    threading.Thread(target=read, daemon=True).start()

    deadline = time.time() + URL_WAIT_SECONDS
    while not found and time.time() < deadline and process.poll() is None:
        time.sleep(0.5)
    return process, (found[0] if found else None)


def main() -> int:
    print("=" * 64)
    print("  BioAttend face service tunnel")
    print("=" * 64)

    cloudflared = find_cloudflared()
    if not cloudflared:
        print("\n  ERROR: cloudflared is not installed. Install it with:")
        print("      winget install --id Cloudflare.cloudflared\n")
        return 1

    if not service_running():
        print("\n  WARNING: the face service is not answering on port 8322.")
        print("  Start run-face-service.bat as well, or phones will see it as offline.\n")

    env = read_env()
    supabase_url = env.get("VITE_SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")

    publisher: Publisher | None = None
    if supabase_url and service_key:
        publisher = Publisher(supabase_url, service_key)
        try:
            publisher.ensure_bucket()
        except Exception as err:  # noqa: BLE001
            print(f"  Could not prepare storage: {err}")
            publisher = None
    else:
        print("  .env.local has no Supabase URL or service role key, so the address")
        print("  cannot be published. Paste it on the phone under Devices instead.\n")

    def publish(url: str | None) -> None:
        if not publisher:
            return
        try:
            publisher.publish(url)
        except Exception as err:  # noqa: BLE001
            print(f"  Could not publish the address: {err}")

    process: subprocess.Popen | None = None
    published = False
    try:
        while True:
            process, url = start_tunnel(cloudflared)
            if not url:
                print("  The tunnel did not start. Retrying in 15 seconds…")
                process.terminate()
                time.sleep(15)
                continue

            publish(url)
            published = True
            stamp = time.strftime("%H:%M:%S")
            print(f"\n  [{stamp}] Tunnel address:  {url}")
            if publisher:
                print("  Published — phones signed in to BioAttend find it automatically.")
            print("  Leave this window open. Close it (or press Ctrl+C) to stop;")
            print("  the address is then withdrawn.")
            print("=" * 64)

            misses = 0
            while process.poll() is None:
                time.sleep(CHECK_EVERY_SECONDS)
                if tunnel_answers(url):
                    misses = 0
                    continue
                misses += 1
                if misses >= MISSES_BEFORE_RESTART:
                    print(f"\n  [{time.strftime('%H:%M:%S')}] The tunnel address stopped "
                          "working (usually a dropped connection). Opening a new one…")
                    break

            process.terminate()
            publish(None)
            time.sleep(3)
    except KeyboardInterrupt:
        return 0
    finally:
        if process is not None:
            process.terminate()
        if published:
            publish(None)
            print("\n  Tunnel closed and address withdrawn.")


if __name__ == "__main__":
    sys.exit(main())
