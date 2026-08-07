"""
Fifth diagnostic: confirm the calling shape.

Evidence so far:
  * First argument is dereferenced (passing 1 or 2 faults reading 0x1 / 0x2),
    so it is a device-context POINTER, not a chip address.
  * ZAZTemplateNum(ctx, &count) wrote to 0xFFFFFFFC — the count pointer landed
    one slot too early.

Both point to the same conclusion: the Windows exports are the Android
signature with a leading context pointer:

    Android :  ZAZGetImage(nAddr)
    Windows :  ZAZGetImage(void* ctx, int nAddr)

Run:  py -3.13-32 diag5.py
"""

import ctypes

from zaz import ZazReader

dev = ZazReader()
dev.open(device_type=2)
ctx = ctypes.c_void_p(dev.handle)
print(f"opened, context = 0x{dev.handle:08X}\n")

lib = dev.lib
c_int = ctypes.c_int
c_void_p = ctypes.c_void_p
p_int = ctypes.POINTER(c_int)

ADDR = 0xFFFFFFFF

print("=" * 64)
print("  ZAZGetImage(ctx, nAddr)  — 0x02 means 'no finger', which is correct")
print("=" * 64)
get_image = lib.ZAZGetImage
get_image.restype = c_int
get_image.argtypes = [c_void_p, ctypes.c_uint]
for label, addr in (("0xFFFFFFFF", 0xFFFFFFFF), ("0", 0), ("1", 1)):
    try:
        code = get_image(ctx, addr)
        flag = "  <-- correct" if code in (0x00, 0x02) else ""
        print(f"  nAddr={label:<12} -> 0x{code & 0xFFFFFFFF:02X}{flag}")
    except OSError as err:
        print(f"  nAddr={label:<12} -> FAULT ({err})")

print()
print("=" * 64)
print("  ZAZTemplateNum(ctx, nAddr, &count)")
print("=" * 64)
tmpl = lib.ZAZTemplateNum
tmpl.restype = c_int
tmpl.argtypes = [c_void_p, ctypes.c_uint, p_int]
for label, addr in (("0xFFFFFFFF", 0xFFFFFFFF), ("0", 0)):
    count = c_int(-1)
    try:
        code = tmpl(ctx, addr, ctypes.byref(count))
        flag = "  <-- correct" if code == 0 else ""
        print(f"  nAddr={label:<12} -> rc={code}  count={count.value}{flag}")
    except OSError as err:
        print(f"  nAddr={label:<12} -> FAULT ({err})")

print()
print("=" * 64)
print("  ZAZReadInfPage(ctx, nAddr, buf)")
print("=" * 64)
info = lib.ZAZReadInfPage
info.restype = c_int
info.argtypes = [c_void_p, ctypes.c_uint, c_void_p]
buf = ctypes.create_string_buffer(512)
try:
    code = info(ctx, ADDR, ctypes.cast(buf, c_void_p))
    print(f"  rc={code}")
    if code == 0:
        text = buf.raw.split(b"\x00", 1)[0].decode("ascii", "replace")
        print(f"  info: {text!r}")
        print(f"  head: {buf.raw[:48].hex(' ')}")
except OSError as err:
    print(f"  FAULT ({err})")

dev.close()
print("\nclosed.")
