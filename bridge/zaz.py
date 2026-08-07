"""
ctypes binding for fpsapit.dll (ZAZ fingerprint SDK).

The reader enumerates as USB mass storage (VID_2009 / PID_7638), not as a
serial port, so the browser cannot reach it directly. This module wraps the
vendor DLL that fpdemo.exe already uses successfully against this exact
device.

The DLL is 32-bit x86, so it needs 32-bit Python. A 64-bit interpreter cannot
load it — the error is unmistakable and checked for below.

Signatures were recovered empirically (see diag*.py). The Android JNI
binding gave the names and argument order, but every Windows export takes an
additional leading device-context pointer.
"""

from __future__ import annotations

import ctypes
import os
import struct
import sys
from dataclasses import dataclass
from typing import Optional

# --- Buffer identifiers -----------------------------------------------------
BUFFER_A = 0x01
BUFFER_B = 0x02
MODEL_BUFFER = 0x03

# Broadcast chip address; the factory default for these modules.
DEFAULT_ADDR = 0xFFFFFFFF

# Template size for this module family.
TEMPLATE_SIZE = 512
IMAGE_BUFFER_SIZE = 93238  # matches the Android sample's bmpdata[]

# --- Confirmation codes -----------------------------------------------------
CONFIRM_MESSAGES = {
    0x00: "Success",
    0x01: "Error receiving packet",
    0x02: "No finger detected",
    0x03: "Could not capture the image — press again",
    0x06: "Image too blurred — wipe the sensor and the fingertip",
    0x07: "Too few features — press flatter and cover more of the sensor",
    0x08: "Fingerprints do not match",
    0x09: "No matching fingerprint found",
    0x0A: "Scans did not combine — the finger moved between presses",
    0x0B: "Storage slot out of range",
    0x0C: "Could not read the stored template",
    0x0D: "Could not upload the template",
    0x0E: "Module failed to receive the packet",
    0x0F: "Could not upload the image",
    0x10: "Could not delete the template",
    0x11: "Could not clear the library",
    0x13: "Wrong device password",
    0x15: "No valid image in the buffer",
    0x18: "Flash write error",
    0x1A: "Invalid register number",
    # Observed on this module: returned by the search commands when the
    # library holds no match, and when the character buffer is empty. Not in
    # the published ZFM code list — established by testing.
    0x47: "No matching fingerprint found",
}


def describe(code: int) -> str:
    return CONFIRM_MESSAGES.get(code, f"Unknown device error (0x{code:02X})")


class ZazError(RuntimeError):
    """Raised when the DLL returns a non-zero confirmation code."""

    def __init__(self, code: int, operation: str = ""):
        self.code = code
        prefix = f"{operation}: " if operation else ""
        super().__init__(f"{prefix}{describe(code)}")


@dataclass
class DeviceInfo:
    device_type: int
    disk_number: int
    template_count: int
    version: str


def _dll_path() -> str:
    """fpsapit.dll ships inside the vendor SDK folder."""
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(here, "fpsapit.dll"),  # copied next to this script
        os.path.join(here, "..", "SDK", "DEMO", "fpdemo_WINDOWS", "fpsapit.dll"),
    ]
    for path in candidates:
        full = os.path.abspath(path)
        if os.path.exists(full):
            return full
    raise FileNotFoundError(
        "fpsapit.dll not found. Expected it beside this script or at "
        "SDK/DEMO/fpdemo_WINDOWS/fpsapit.dll"
    )


class ZazReader:
    """Thin, typed wrapper around the vendor DLL."""

    def __init__(self) -> None:
        if struct.calcsize("P") * 8 != 32:
            raise RuntimeError(
                "fpsapit.dll is 32-bit, but this is a "
                f"{struct.calcsize('P') * 8}-bit Python interpreter.\n"
                "Install 32-bit Python (the 'Windows installer (32-bit)' build) "
                "and run the bridge with that."
            )

        path = _dll_path()

        # Exports are undecorated, which is ambiguous between cdecl and
        # stdcall. cdecl is tried first because the caller cleans the stack,
        # so a mismatch degrades rather than corrupting.
        try:
            self.lib = ctypes.CDLL(path)
            self._convention = "cdecl"
        except OSError:
            self.lib = ctypes.WinDLL(path)
            self._convention = "stdcall"

        self._declare()
        self._open = False
        self.device_type: Optional[int] = None
        self.disk_number: int = 0
        self.handle: int = 0

    # -- signature declarations ---------------------------------------------
    def _declare(self) -> None:
        """
        Windows signatures, recovered empirically (see bridge/diag*.py).

        The vendor shipped no header, and the Android JNI binding does not
        transfer directly. The rule, confirmed by probing, is:

            Android :  ZAZGetImage(nAddr)
            Windows :  ZAZGetImage(void* ctx, int nAddr)

        Every command takes a leading device-context pointer, obtained as an
        OUT parameter from ZAZOpenDeviceEx. Verified working:
            ZAZGetImage(ctx, 0xFFFFFFFF)        -> 0x02 "no finger"
            ZAZTemplateNum(ctx, 0xFFFFFFFF, &n) -> 0, n = 0
            ZAZReadInfPage(ctx, 0xFFFFFFFF, b)  -> 0, b = "Demo Ver 1.34 LIROX"
        """
        c_int = ctypes.c_int
        c_uint = ctypes.c_uint
        c_void_p = ctypes.c_void_p
        p_byte = ctypes.POINTER(ctypes.c_ubyte)
        p_int = ctypes.POINTER(ctypes.c_int)

        def sig(name: str, restype, argtypes):
            fn = getattr(self.lib, name, None)
            if fn is None:
                return None
            fn.restype = restype
            fn.argtypes = argtypes
            return fn

        # First parameter is an OUT pointer receiving the device context —
        # the Windows counterpart of Android's `int fd`.
        self.ZAZOpenDeviceEx = sig(
            "ZAZOpenDeviceEx", c_int, [p_int, c_int, c_int, c_int, c_int, c_int]
        )
        self.ZAZCloseDeviceEx = sig("ZAZCloseDeviceEx", c_int, [c_void_p])
        # Writes one ASCII drive letter per attached reader; returns the count.
        self.ZAZGetUDiskNum = sig("ZAZGetUDiskNum", c_int, [c_void_p])

        self.ZAZGetImage = sig("ZAZGetImage", c_int, [c_void_p, c_uint])
        self.ZAZGenChar = sig("ZAZGenChar", c_int, [c_void_p, c_uint, c_int])
        self.ZAZRegModule = sig("ZAZRegModule", c_int, [c_void_p, c_uint])
        self.ZAZUpChar = sig("ZAZUpChar", c_int, [c_void_p, c_uint, c_int, p_byte, p_int])
        self.ZAZDownChar = sig("ZAZDownChar", c_int, [c_void_p, c_uint, c_int, p_byte, c_int])
        self.ZAZStoreChar = sig("ZAZStoreChar", c_int, [c_void_p, c_uint, c_int, c_int])
        self.ZAZLoadChar = sig("ZAZLoadChar", c_int, [c_void_p, c_uint, c_int, c_int])
        self.ZAZMatch = sig("ZAZMatch", c_int, [c_void_p, c_uint, p_int])
        # Both searches take TWO separate out-pointers — page id and score —
        # not one packed array. Recovered in diag6.py; a single pointer faults
        # with "access violation writing 0x00000053".
        self.ZAZSearch = sig(
            "ZAZSearch", c_int, [c_void_p, c_uint, c_int, c_int, c_int, p_int, p_int]
        )
        self.ZAZHighSpeedSearch = sig(
            "ZAZHighSpeedSearch", c_int,
            [c_void_p, c_uint, c_int, c_int, c_int, p_int, p_int],
        )
        self.ZAZTemplateNum = sig("ZAZTemplateNum", c_int, [c_void_p, c_uint, p_int])
        self.ZAZDelChar = sig("ZAZDelChar", c_int, [c_void_p, c_uint, c_int, c_int])
        self.ZAZEmpty = sig("ZAZEmpty", c_int, [c_void_p, c_uint])
        self.ZAZUpImage = sig("ZAZUpImage", c_int, [c_void_p, c_uint, p_byte, p_int])
        self.ZAZReadInfPage = sig("ZAZReadInfPage", c_int, [c_void_p, c_uint, p_byte])
        self.ZAZVfyPwd = sig("ZAZVfyPwd", c_int, [c_void_p, c_uint, p_byte])
        self.ZAZSetSecurLevel = sig("ZAZSetSecurLevel", c_int, [c_void_p, c_uint, c_int])

    # -- helpers -------------------------------------------------------------
    @staticmethod
    def _check(code: int, operation: str) -> None:
        if code != 0:
            raise ZazError(code, operation)

    @property
    def is_open(self) -> bool:
        return self._open

    # -- connection ----------------------------------------------------------
    def probe_device_types(self, candidates=range(0, 36)) -> list[int]:
        """
        Find which nDeviceType constants open this reader.

        Device type 2 is the answer for this hardware (USB mass-storage
        transport), found by probing. Kept because a replacement reader from
        a different batch may differ.
        """
        working: list[int] = []
        for dev_type in candidates:
            handle = ctypes.c_int(0)
            try:
                code = self.ZAZOpenDeviceEx(ctypes.byref(handle), dev_type, 1, 57600, 2, 0)
            except OSError:
                continue
            if code == 0:
                working.append(dev_type)
                try:
                    self.ZAZCloseDeviceEx(ctypes.c_void_p(handle.value))
                except OSError:
                    pass
        return working

    def list_drives(self) -> list[str]:
        """Drive letters of attached readers — this device mounts as a disc."""
        if self.ZAZGetUDiskNum is None:
            return []
        buf = ctypes.create_string_buffer(64)
        try:
            count = self.ZAZGetUDiskNum(ctypes.cast(buf, ctypes.c_void_p))
        except OSError:
            return []
        return [chr(b) for b in buf.raw[: max(0, count)] if b]

    def get_disk_number(self) -> int:
        """Index of the reader to open. Zero-based, not the drive letter."""
        return 0

    def open(
        self,
        device_type: int = 2,
        baud: int = 57600,
        package_size: int = 2,
        dev_num: int = 0,
    ) -> None:
        handle = ctypes.c_int(0)
        code = self.ZAZOpenDeviceEx(
            ctypes.byref(handle), device_type, 1, baud, package_size, dev_num
        )
        self._check(code, "Open device")
        self._open = True
        self.handle = handle.value
        self.device_type = device_type
        self.disk_number = dev_num

    def close(self) -> None:
        if self._open and self.ZAZCloseDeviceEx is not None:
            try:
                self.ZAZCloseDeviceEx(ctypes.c_void_p(self.handle))
            except OSError:
                pass
        self._open = False

    # -- capture -------------------------------------------------------------
    @property
    def _ctx(self) -> ctypes.c_void_p:
        if not self._open:
            raise RuntimeError("Device is not open. Call open() first.")
        return ctypes.c_void_p(self.handle)

    def get_image(self, addr: int = DEFAULT_ADDR) -> int:
        """Capture one frame. Returns the raw code — 0x02 means no finger yet."""
        return self.ZAZGetImage(self._ctx, addr)

    def gen_char(self, buffer_id: int, addr: int = DEFAULT_ADDR) -> None:
        self._check(self.ZAZGenChar(self._ctx, addr, buffer_id), "Extract features")

    def reg_module(self, addr: int = DEFAULT_ADDR) -> None:
        self._check(self.ZAZRegModule(self._ctx, addr), "Combine scans")

    def up_char(self, buffer_id: int = BUFFER_A, addr: int = DEFAULT_ADDR) -> bytes:
        """Pull a template out of the module — this is what reaches Supabase."""
        buf = (ctypes.c_ubyte * TEMPLATE_SIZE)()
        length = ctypes.c_int(TEMPLATE_SIZE)
        code = self.ZAZUpChar(
            self._ctx,
            addr,
            buffer_id,
            ctypes.cast(buf, ctypes.POINTER(ctypes.c_ubyte)),
            ctypes.byref(length),
        )
        self._check(code, "Upload template")
        size = length.value if 0 < length.value <= TEMPLATE_SIZE else TEMPLATE_SIZE
        return bytes(buf[:size])

    def down_char(
        self, template: bytes, buffer_id: int = BUFFER_A, addr: int = DEFAULT_ADDR
    ) -> None:
        """Push a template from Supabase into a module buffer."""
        buf = (ctypes.c_ubyte * len(template)).from_buffer_copy(template)
        code = self.ZAZDownChar(
            self._ctx,
            addr,
            buffer_id,
            ctypes.cast(buf, ctypes.POINTER(ctypes.c_ubyte)),
            len(template),
        )
        self._check(code, "Download template")

    # -- library -------------------------------------------------------------
    def store_char(self, page_id: int, buffer_id: int = BUFFER_A, addr: int = DEFAULT_ADDR) -> None:
        self._check(self.ZAZStoreChar(self._ctx, addr, buffer_id, page_id), "Store template")

    def delete_char(self, start_page: int, count: int = 1, addr: int = DEFAULT_ADDR) -> None:
        self._check(self.ZAZDelChar(self._ctx, addr, start_page, count), "Delete template")

    def empty(self, addr: int = DEFAULT_ADDR) -> None:
        self._check(self.ZAZEmpty(self._ctx, addr), "Clear library")

    def template_count(self, addr: int = DEFAULT_ADDR) -> int:
        count = ctypes.c_int(0)
        self._check(
            self.ZAZTemplateNum(self._ctx, addr, ctypes.byref(count)), "Read template count"
        )
        return count.value

    def high_speed_search(
        self,
        start_page: int = 0,
        page_count: int = 1000,
        buffer_id: int = BUFFER_A,
        addr: int = DEFAULT_ADDR,
    ) -> Optional[tuple[int, int]]:
        """
        1:N search — the kiosk path.

        Returns (page_id, score), or None when nothing matched. None is a
        legitimate outcome: the caller must reject rather than fall back to a
        next-best guess.
        """
        page_id = ctypes.c_int(-1)
        score = ctypes.c_int(0)
        code = self.ZAZHighSpeedSearch(
            self._ctx,
            addr,
            buffer_id,
            start_page,
            page_count,
            ctypes.byref(page_id),
            ctypes.byref(score),
        )
        # 0x09 is the documented "not found". 0x47 is what this module
        # actually returns for the same condition. Both mean nobody matched,
        # which is an ordinary outcome — the caller rejects the scan rather
        # than treating it as a device failure.
        if code in (0x09, 0x47):
            return None
        self._check(code, "Search library")
        return page_id.value, score.value

    def match(self, addr: int = DEFAULT_ADDR) -> int:
        """1:1 comparison of buffer A against buffer B. Returns the score."""
        score = ctypes.c_int(0)
        code = self.ZAZMatch(self._ctx, addr, ctypes.byref(score))
        if code == 0x08:  # no match
            return 0
        self._check(code, "Match")
        return score.value

    def read_info_page(self, addr: int = DEFAULT_ADDR) -> bytes:
        """Raw info page. Contains the product string and module settings."""
        if self.ZAZReadInfPage is None:
            return b""
        buf = (ctypes.c_ubyte * 512)()
        code = self.ZAZReadInfPage(
            self._ctx, addr, ctypes.cast(buf, ctypes.POINTER(ctypes.c_ubyte))
        )
        return bytes(buf) if code == 0 else b""

    def read_version(self, addr: int = DEFAULT_ADDR) -> str:
        """Printable product/version string, e.g. 'Demo  Ver 1.34LIROX'."""
        raw = self.read_info_page(addr)
        if not raw:
            return ""
        text = "".join(chr(b) if 32 <= b < 127 else " " for b in raw)
        return " ".join(text.split()).strip()
