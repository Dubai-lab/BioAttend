"""
End-to-end device test.

Opens the reader, reads what it can without a finger, then optionally waits
for a live capture. Proves the binding works before the web app depends on it.

Run:  py -3.13-32 test_device.py
"""

import sys
import time

from zaz import BUFFER_A, BUFFER_B, DEFAULT_ADDR, ZazError, ZazReader

dev = ZazReader()
print(f"DLL loaded ({dev._convention})")
print(f"Drives reporting a reader: {dev.list_drives()}")

print("\nOpening device (type 2, USB-disk transport)...")
dev.open(device_type=2)
print(f"  opened, handle = {dev.handle}")

# --- reads that need no finger ---------------------------------------------
print("\nDevice queries:")
try:
    print(f"  template count : {dev.template_count()}")
except ZazError as err:
    print(f"  template count : failed — {err}")
except OSError as err:
    print(f"  template count : FAULT — {err}")

try:
    version = dev.read_version()
    print(f"  info page      : {version!r}")
except (ZazError, OSError) as err:
    print(f"  info page      : failed — {err}")

# --- live capture -----------------------------------------------------------
if "--capture" in sys.argv:
    print("\nPlace a finger on the sensor...")
    deadline = time.time() + 20
    captured = False
    while time.time() < deadline:
        code = dev.get_image()
        if code == 0:
            captured = True
            break
        if code != 0x02:  # 0x02 = no finger yet
            print(f"  capture error: 0x{code:02X}")
            break
        time.sleep(0.1)

    if captured:
        print("  image captured")
        dev.gen_char(BUFFER_A)
        print("  features extracted into buffer A")

        print("\n  Lift the finger, then place the SAME finger again...")
        while dev.get_image() != 0x02:
            time.sleep(0.1)
        time.sleep(0.4)

        deadline = time.time() + 20
        while time.time() < deadline:
            if dev.get_image() == 0:
                break
            time.sleep(0.1)

        dev.gen_char(BUFFER_B)
        print("  second scan extracted into buffer B")

        dev.reg_module()
        print("  scans merged into one template")

        template = dev.up_char(BUFFER_A)
        print(f"\n  TEMPLATE: {len(template)} bytes")
        print(f"  first 32 bytes: {template[:32].hex(' ')}")
    else:
        print("  no finger detected within the timeout")

dev.close()
print("\nDevice closed.")
