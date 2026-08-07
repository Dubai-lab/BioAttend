"""
Diagnostic for ZAZOpenDeviceEx.

The blind probe reported nothing working, which tells us only that no call
returned 0. This prints the ACTUAL return code for every combination so the
failure mode is visible rather than guessed at.

Run with 32-bit Python:   py -3.13-32 diag.py
"""

import ctypes
import os
import struct
import sys

print(f"Python {sys.version.split()[0]}  ({struct.calcsize('P') * 8}-bit)")

here = os.path.dirname(os.path.abspath(__file__))
dll_path = os.path.abspath(
    os.path.join(here, "..", "SDK", "DEMO", "fpdemo_WINDOWS", "fpsapit.dll")
)
print(f"DLL: {dll_path}")
print(f"exists: {os.path.exists(dll_path)}\n")

results = {}

for convention, loader in (("cdecl", ctypes.CDLL), ("stdcall", ctypes.WinDLL)):
    print("=" * 60)
    print(f"  Calling convention: {convention}")
    print("=" * 60)

    try:
        lib = loader(dll_path)
    except OSError as err:
        print(f"  could not load: {err}\n")
        continue

    # --- ZAZGetUDiskNum ----------------------------------------------------
    try:
        fn = lib.ZAZGetUDiskNum
        fn.restype = ctypes.c_int
        fn.argtypes = []
        disk_num = fn()
        print(f"  ZAZGetUDiskNum() -> {disk_num}")
    except Exception as err:  # noqa: BLE001
        disk_num = None
        print(f"  ZAZGetUDiskNum failed: {err}")

    # --- ZAZOpenDeviceEx across the parameter space -------------------------
    try:
        open_fn = lib.ZAZOpenDeviceEx
        open_fn.restype = ctypes.c_int
        open_fn.argtypes = [ctypes.c_int] * 6
    except AttributeError:
        print("  ZAZOpenDeviceEx not exported\n")
        continue

    try:
        close_fn = lib.ZAZCloseDeviceEx
        close_fn.restype = ctypes.c_int
        close_fn.argtypes = []
    except AttributeError:
        close_fn = None

    print("\n  dev_type x dev_num  ->  return code   (0 = success)")
    print("  " + "-" * 52)

    for dev_type in range(0, 36):
        row = []
        for dev_num in range(0, 4):
            try:
                code = open_fn(0, dev_type, 1, 57600, 2, dev_num)
            except OSError as err:
                row.append(f"n{dev_num}=EX")
                continue

            row.append(f"n{dev_num}={code}")
            if code == 0:
                results[(convention, dev_type, dev_num)] = code
                if close_fn:
                    try:
                        close_fn()
                    except OSError:
                        pass

        # Only print rows that are not uniformly the same failure.
        distinct = {part.split("=")[1] for part in row}
        marker = "  <-- SUCCESS" if any(p.endswith("=0") for p in row) else ""
        if marker or len(distinct) > 1:
            print(f"  type {dev_type:2d}  " + "  ".join(row) + marker)

    print()

print("=" * 60)
if results:
    print("  WORKING COMBINATIONS:")
    for (conv, dev_type, dev_num), _ in results.items():
        print(f"    convention={conv}  nDeviceType={dev_type}  iDevNum={dev_num}")
else:
    print("  No combination returned 0.")
    print("  The return codes above indicate what the DLL is objecting to.")
print("=" * 60)
