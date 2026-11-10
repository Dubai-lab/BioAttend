"""
Diagnostic: what does the reader report with NOTHING on it?

Polls GetImage for a fixed time and, whenever it claims an image (code 0),
tries feature extraction too. A clean, empty sensor should answer 0x02
("no finger") every time. Run with the bridge stopped:

    py -3-32 diag_ghost.py [seconds]
"""
import sys
import time
from collections import Counter

from zaz import BUFFER_A, ZazError, ZazReader, describe

seconds = float(sys.argv[1]) if len(sys.argv) > 1 else 15
dev = ZazReader()
dev.open(2)
codes = Counter()
extract = Counter()
runs, run = [], 0
end = time.time() + seconds
while time.time() < end:
    code = dev.get_image()
    codes[code] += 1
    if code == 0:
        run += 1
        try:
            dev.gen_char(BUFFER_A)
            extract["features OK"] += 1
        except ZazError as err:
            extract[describe(err.code)] += 1
    elif run:
        runs.append(run)
        run = 0
    time.sleep(0.1)
if run:
    runs.append(run)
dev.close()

print("GetImage codes over", seconds, "s:")
for code, n in codes.most_common():
    print(f"  0x{code:02X}  x{n:<4} {describe(code)}")
print("When it claimed an image, extraction gave:", dict(extract) or "-")
print("Consecutive 'image' runs (frames):", runs or "-")
