"""Losslessly shrink the PNGs in images/ (run after render.mjs).

The tool exports black ink on a transparent background as 8-bit RGBA. All colour channels are 0,
so the image is stored as grayscale + alpha (PNG colour type 4) with maximum zlib compression.
Every file is decoded again and compared with the original pixel by pixel; the script stops if
any pixel differs. Usage: python optimize_images.py   (needs Pillow)
"""

import glob
import io
import os
import sys

from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
before = after = 0
for path in sorted(glob.glob(os.path.join(here, "images", "*.png"))):
    src = Image.open(path).convert("RGBA")
    r, g, b, a = src.split()
    if src.mode != "RGBA" or any(ch.getextrema() != (0, 0) for ch in (r, g, b)):
        sys.exit(f"{path}: colour channels are not all 0, not converting")
    buf = io.BytesIO()
    Image.merge("LA", (r, a)).save(buf, format="PNG", optimize=True, compress_level=9)
    if Image.open(io.BytesIO(buf.getvalue())).convert("RGBA").tobytes() != src.tobytes():
        sys.exit(f"{path}: pixels changed, not writing")
    before += os.path.getsize(path)
    with open(path, "wb") as f:
        f.write(buf.getvalue())
    after += len(buf.getvalue())
print(f"images: {before} -> {after} bytes")
