"""
Fourth diagnostic: what is the first parameter of the command functions?

The device opens, but ZAZTemplateNum(0xFFFFFFFF, &n) returns -1. On Android
that first argument is the chip address; on Windows it may instead be the
handle that ZAZOpenDeviceEx hands back, or a device index.

ZAZGetImage is the ideal probe: with no finger on the sensor a correct call
returns 0x02 ("no finger"). Anything else means the argument is wrong.

Run:  py -3.13-32 diag4.py
"""

import ctypes

from zaz import ZazReader

dev = ZazReader()
dev.open(device_type=2)
print(f"opened, handle = {dev.handle}\n")

candidates = [
    ("0xFFFFFFFF (chip broadcast)", 0xFFFFFFFF),
    ("handle", dev.handle),
    ("0", 0),
    ("1", 1),
    ("2", 2),
]

print("=" * 62)
print("  ZAZGetImage(nAddr)   — expecting 0x02 'no finger' when correct")
print("=" * 62)
for label, value in candidates:
    try:
        code = dev.ZAZGetImage(value)
        note = "  <-- correct (no finger)" if code == 0x02 else ""
        note = "  <-- correct (finger present!)" if code == 0 else note
        print(f"  {label:<28} -> 0x{code & 0xFFFFFFFF:02X}{note}")
    except OSError as err:
        print(f"  {label:<28} -> FAULT ({err})")

print()
print("=" * 62)
print("  ZAZTemplateNum(nAddr, &count)")
print("=" * 62)
for label, value in candidates:
    count = ctypes.c_int(-1)
    try:
        code = dev.ZAZTemplateNum(value, ctypes.byref(count))
        note = "  <-- correct" if code == 0 else ""
        print(f"  {label:<28} -> rc={code}  count={count.value}{note}")
    except OSError as err:
        print(f"  {label:<28} -> FAULT ({err})")

dev.close()
print("\nclosed.")
