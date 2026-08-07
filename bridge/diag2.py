"""
Second diagnostic: recover the real Windows signatures.

diag.py showed ZAZGetUDiskNum crashing with an access violation while writing
to a low address — the classic signature of a function that expects an
out-parameter pointer and was handed stack garbage instead.

Every other function in this SDK returns results through out-params
(int[] iMbNum, int[] iScore, ...), so ZAZGetUDiskNum(int* pNum) is the
obvious candidate. This tests that, then works outward.

Run:  py -3.13-32 diag2.py
"""

import ctypes
import os
import struct
import sys

print(f"Python {sys.version.split()[0]}  ({struct.calcsize('P') * 8}-bit)\n")

here = os.path.dirname(os.path.abspath(__file__))
dll_path = os.path.abspath(
    os.path.join(here, "..", "SDK", "DEMO", "fpdemo_WINDOWS", "fpsapit.dll")
)

lib = ctypes.CDLL(dll_path)
c_int = ctypes.c_int


def attempt(label, fn, *args):
    """Call fn, reporting the result or the fault, without dying."""
    try:
        value = fn(*args)
        print(f"  {label:<44} -> {value}")
        return value
    except OSError as err:
        print(f"  {label:<44} -> FAULT ({err})")
        return None
    except Exception as err:  # noqa: BLE001
        print(f"  {label:<44} -> ERROR ({type(err).__name__}: {err})")
        return None


print("=" * 68)
print("  ZAZGetUDiskNum — argument shape")
print("=" * 68)

disk_number = None

# Candidate A: int ZAZGetUDiskNum(int* pNum)
fn = lib.ZAZGetUDiskNum
fn.restype = c_int
fn.argtypes = [ctypes.POINTER(c_int)]
out = c_int(0)
rc = attempt("ZAZGetUDiskNum(&out)", fn, ctypes.byref(out))
if rc is not None:
    print(f"      out value = {out.value}")
    if rc == 0:
        disk_number = out.value

# Candidate B: a wider buffer, in case it writes a struct or string
if disk_number is None:
    fn2 = lib.ZAZGetUDiskNum
    fn2.restype = c_int
    fn2.argtypes = [ctypes.c_void_p]
    buf = ctypes.create_string_buffer(256)
    rc = attempt("ZAZGetUDiskNum(char[256])", fn2, ctypes.cast(buf, ctypes.c_void_p))
    if rc is not None:
        head = buf.raw[:16].hex(" ")
        print(f"      buffer head = {head}")
        if rc >= 0:
            disk_number = rc

print()
print("=" * 68)
print("  ZAZOpenDeviceEx — argument count and device type")
print("=" * 68)

candidates = [] if disk_number is None else [disk_number]
candidates += [n for n in range(0, 4) if n not in candidates]

found = []

for arg_count in (6, 5, 4):
    open_fn = lib.ZAZOpenDeviceEx
    open_fn.restype = c_int
    open_fn.argtypes = [c_int] * arg_count

    close_fn = lib.ZAZCloseDeviceEx
    close_fn.restype = c_int
    close_fn.argtypes = []

    print(f"\n  --- {arg_count} integer arguments ---")
    faults = 0

    for dev_type in range(0, 36):
        for dev_num in candidates:
            if arg_count == 6:
                args = (0, dev_type, 1, 57600, 2, dev_num)
            elif arg_count == 5:
                args = (dev_type, 1, 57600, 2, dev_num)
            else:
                args = (dev_type, 1, 57600, dev_num)

            try:
                code = open_fn(*args)
            except OSError:
                faults += 1
                continue

            if code == 0:
                print(f"  SUCCESS  argc={arg_count} nDeviceType={dev_type} iDevNum={dev_num}")
                found.append((arg_count, dev_type, dev_num))
                try:
                    close_fn()
                except OSError:
                    pass
            elif code not in (-1, 1):
                # Anything other than the usual blanket failure is informative.
                print(f"  type={dev_type:2d} num={dev_num} -> {code}")

    if faults:
        print(f"  ({faults} calls faulted)")

print()
print("=" * 68)
if found:
    print("  WORKING:")
    for argc, dev_type, dev_num in found:
        print(f"    argc={argc}  nDeviceType={dev_type}  iDevNum={dev_num}")
else:
    print("  Still nothing opened. The Windows DLL's signatures differ from")
    print("  the Android binding and need disassembly to recover.")
print("=" * 68)
