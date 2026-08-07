"""
Sixth diagnostic: the real signature of ZAZHighSpeedSearch / ZAZSearch.

/identify faults with "access violation writing 0x00000053", so the result
out-pointer is landing in the wrong argument slot.

No finger is needed. With an empty character buffer a CORRECT signature
returns an error code (0x15 "no valid image" or 0x09 "not found"); a WRONG one
faults. That difference is the whole test.

Run:  py -3.13-32 diag6.py
"""

import ctypes

from zaz import BUFFER_A, DEFAULT_ADDR, ZazReader

dev = ZazReader()
dev.open(device_type=2)
ctx = ctypes.c_void_p(dev.handle)
print(f"opened, context = 0x{dev.handle:08X}")
print(f"templates in flash: {dev.template_count()}\n")

lib = dev.lib
c_int = ctypes.c_int
c_uint = ctypes.c_uint
c_void_p = ctypes.c_void_p
p_int = ctypes.POINTER(c_int)

ADDR = DEFAULT_ADDR
START = 0
COUNT = 100


def probe(name, argtypes, build_args, description):
    """Call one candidate signature and report code vs fault."""
    fn = getattr(lib, name)
    fn.restype = c_int
    fn.argtypes = argtypes

    out = (c_int * 4)()
    out2 = (c_int * 4)()

    try:
        code = fn(*build_args(out, out2))
    except OSError as err:
        print(f"  {description:<52} FAULT  ({err})")
        return None

    verdict = ""
    if code in (0x00, 0x09, 0x15, 0x01):
        verdict = "  <-- plausible"
    print(f"  {description:<52} rc=0x{code & 0xFFFFFFFF:02X}  out={out[0]},{out[1]}{verdict}")
    return code


print("=" * 78)
print("  ZAZHighSpeedSearch")
print("=" * 78)

# A: ctx, addr, buffer, start, count, int* (id and score packed into one array)
probe(
    "ZAZHighSpeedSearch",
    [c_void_p, c_uint, c_int, c_int, c_int, p_int],
    lambda o, o2: (ctx, ADDR, BUFFER_A, START, COUNT, ctypes.cast(o, p_int)),
    "(ctx, addr, buf, start, count, int*)",
)

# B: separate out pointers for page id and score
probe(
    "ZAZHighSpeedSearch",
    [c_void_p, c_uint, c_int, c_int, c_int, p_int, p_int],
    lambda o, o2: (
        ctx, ADDR, BUFFER_A, START, COUNT,
        ctypes.cast(o, p_int), ctypes.cast(o2, p_int),
    ),
    "(ctx, addr, buf, start, count, int* id, int* score)",
)

# C: no address parameter
probe(
    "ZAZHighSpeedSearch",
    [c_void_p, c_int, c_int, c_int, p_int],
    lambda o, o2: (ctx, BUFFER_A, START, COUNT, ctypes.cast(o, p_int)),
    "(ctx, buf, start, count, int*)",
)

# D: no address, separate out pointers
probe(
    "ZAZHighSpeedSearch",
    [c_void_p, c_int, c_int, c_int, p_int, p_int],
    lambda o, o2: (
        ctx, BUFFER_A, START, COUNT,
        ctypes.cast(o, p_int), ctypes.cast(o2, p_int),
    ),
    "(ctx, buf, start, count, int* id, int* score)",
)

print()
print("=" * 78)
print("  ZAZSearch")
print("=" * 78)

probe(
    "ZAZSearch",
    [c_void_p, c_uint, c_int, c_int, c_int, p_int],
    lambda o, o2: (ctx, ADDR, BUFFER_A, START, COUNT, ctypes.cast(o, p_int)),
    "(ctx, addr, buf, start, count, int*)",
)

probe(
    "ZAZSearch",
    [c_void_p, c_uint, c_int, c_int, c_int, p_int, p_int],
    lambda o, o2: (
        ctx, ADDR, BUFFER_A, START, COUNT,
        ctypes.cast(o, p_int), ctypes.cast(o2, p_int),
    ),
    "(ctx, addr, buf, start, count, int* id, int* score)",
)

print()
print("=" * 78)
print("  ZAZMatch  (1:1, for comparison)")
print("=" * 78)

probe(
    "ZAZMatch",
    [c_void_p, c_uint, p_int],
    lambda o, o2: (ctx, ADDR, ctypes.cast(o, p_int)),
    "(ctx, addr, int* score)",
)

dev.close()
print("\nclosed.")
