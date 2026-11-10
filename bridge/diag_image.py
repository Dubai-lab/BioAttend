"""
Diagnostic: image statistics, empty sensor vs. a real finger.

Every ~0.4 s, captures an image, uploads it, and prints its size, brightness
and contrast, plus whether features could be extracted. Run with the bridge
stopped:

    py -3-32 diag_image.py [seconds]
"""
import ctypes
import statistics
import sys
import time

from zaz import BUFFER_A, DEFAULT_ADDR, IMAGE_BUFFER_SIZE, ZazError, ZazReader, describe

seconds = float(sys.argv[1]) if len(sys.argv) > 1 else 30
dev = ZazReader()
dev.open(2)


def up_image() -> bytes:
    buf = (ctypes.c_ubyte * IMAGE_BUFFER_SIZE)()
    length = ctypes.c_int(IMAGE_BUFFER_SIZE)
    code = dev.ZAZUpImage(dev._ctx, DEFAULT_ADDR, ctypes.cast(buf, ctypes.POINTER(ctypes.c_ubyte)), ctypes.byref(length))
    if code != 0:
        raise ZazError(code, "Upload image")
    return bytes(buf[: length.value if 0 < length.value <= IMAGE_BUFFER_SIZE else IMAGE_BUFFER_SIZE])


start = time.time()
saved = 0
while time.time() - start < seconds:
    t = time.time() - start
    code = dev.get_image()
    if code != 0:
        print(f"{t:5.1f}s  GetImage 0x{code:02X} {describe(code)}", flush=True)
        time.sleep(0.4)
        continue
    try:
        img = up_image()
    except ZazError as err:
        print(f"{t:5.1f}s  upload failed: {err}", flush=True)
        time.sleep(0.4)
        continue
    # Skip a BMP header if the DLL returns one.
    pixels = img[1078:] if img[:2] == b"BM" else img
    mean = statistics.fmean(pixels)
    sd = statistics.pstdev(pixels)
    dark = sum(1 for p in pixels if p < 128) / len(pixels)
    try:
        dev.gen_char(BUFFER_A)
        feat = "features OK"
    except ZazError as err:
        feat = describe(err.code)
    print(f"{t:5.1f}s  len={len(img)} bmp={img[:2] == b'BM'}  mean={mean:6.1f}  sd={sd:5.1f}  dark={dark:4.2f}  {feat}", flush=True)
    time.sleep(0.4)
dev.close()

