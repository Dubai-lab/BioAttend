"""
Third diagnostic: ZAZOpenDeviceEx with a pointer first argument.

Two facts from diag2:
  * ZAZGetUDiskNum(char*) returns 1 and writes 0x44 = 'D' — it reports
    detected readers by DRIVE LETTER, and there is one, on D:.
  * ZAZOpenDeviceEx faults on every all-integer signature, and the fault is
    an access violation *writing*, which is what a null out-pointer produces.

The Android binding's first parameter is `int fd`. On Windows the equivalent
is most likely an out-parameter that receives a handle. Passing 0 for it would
crash exactly as observed.

Run:  py -3.13-32 diag3.py
"""

import ctypes
import os

here = os.path.dirname(os.path.abspath(__file__))
dll_path = os.path.abspath(
    os.path.join(here, "..", "SDK", "DEMO", "fpdemo_WINDOWS", "fpsapit.dll")
)

lib = ctypes.CDLL(dll_path)
c_int = ctypes.c_int
p_int = ctypes.POINTER(c_int)

# Drive letters of attached readers.
letters = ctypes.create_string_buffer(64)
get_disk = lib.ZAZGetUDiskNum
get_disk.restype = c_int
get_disk.argtypes = [ctypes.c_void_p]
count = get_disk(ctypes.cast(letters, ctypes.c_void_p))
drives = [b for b in letters.raw[:count] if b]
print(f"Readers found: {count}   drive letters: {[chr(b) for b in drives]}\n")

close_fn = lib.ZAZCloseDeviceEx
close_fn.restype = c_int
close_fn.argtypes = []

dev_nums = [*{*drives, 0, 1}]  # try the drive letter value and small indices

print("=" * 70)
print("  ZAZOpenDeviceEx(int* out, type, com, baud, pkt, devnum)")
print("=" * 70)

found = []

open_fn = lib.ZAZOpenDeviceEx
open_fn.restype = c_int
open_fn.argtypes = [p_int, c_int, c_int, c_int, c_int, c_int]

faults = 0
for dev_type in range(0, 36):
    for dev_num in dev_nums:
        handle = c_int(0)
        try:
            code = open_fn(ctypes.byref(handle), dev_type, 1, 57600, 2, dev_num)
        except OSError:
            faults += 1
            continue

        if code == 0:
            print(f"  SUCCESS  type={dev_type} devnum={dev_num} handle={handle.value}")
            found.append((dev_type, dev_num, handle.value))
            try:
                close_fn()
            except OSError:
                pass
        elif code not in (-1, 1):
            print(f"  type={dev_type:2d} devnum={dev_num} -> {code}")

print(f"  ({faults} faulted)\n")

# Same idea, but the handle-out and the device number swapped for a 5-arg form.
print("=" * 70)
print("  ZAZOpenDeviceEx(int* out, type, com, baud, devnum)")
print("=" * 70)

open5 = lib.ZAZOpenDeviceEx
open5.restype = c_int
open5.argtypes = [p_int, c_int, c_int, c_int, c_int]

faults = 0
for dev_type in range(0, 36):
    for dev_num in dev_nums:
        handle = c_int(0)
        try:
            code = open5(ctypes.byref(handle), dev_type, 1, 57600, dev_num)
        except OSError:
            faults += 1
            continue
        if code == 0:
            print(f"  SUCCESS  type={dev_type} devnum={dev_num} handle={handle.value}")
            found.append((dev_type, dev_num, handle.value))
            try:
                close_fn()
            except OSError:
                pass
        elif code not in (-1, 1):
            print(f"  type={dev_type:2d} devnum={dev_num} -> {code}")

print(f"  ({faults} faulted)\n")

print("=" * 70)
if found:
    print("  WORKING COMBINATIONS:")
    for item in found:
        print(f"    {item}")
else:
    print("  No success. Next step would be disassembling fpdemo.exe's call")
    print("  site to read the real signature off the stack setup.")
print("=" * 70)
