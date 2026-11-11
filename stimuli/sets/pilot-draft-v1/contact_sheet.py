"""Draw preview.png: all items of this set on a white background, with item id and source.

Usage: python contact_sheet.py /path/to/SourceHanSerifTC-Regular.otf   (needs Pillow)
"""

import csv
import os
import sys

from PIL import Image, ImageDraw, ImageFont

here = os.path.dirname(os.path.abspath(__file__))
rows = list(csv.DictReader(open(os.path.join(here, "items.csv"), encoding="utf-8-sig")))
font = ImageFont.truetype(sys.argv[1], 15)
cols, cell, lab = 10, 120, 22
im = Image.new("RGB", (cols * cell, -(-len(rows) // cols) * (cell + lab)), "white")
draw = ImageDraw.Draw(im)
for i, r in enumerate(rows):
    x, y = (i % cols) * cell, (i // cols) * (cell + lab)
    g = Image.open(os.path.join(here, "images", r["image"])).convert("RGBA").resize((cell - 8, cell - 8))
    draw.rectangle([x + 3, y + 3, x + cell - 4, y + cell - 4], outline=(225, 225, 225))
    im.paste(g, (x + 4, y + 4), g)
    text = r["char"] if r["lexicality"] == "real" else r["source_a"] + "+" + r["source_b"]
    tag = {"real": r["freq_band"], "pseudo_legal_position": "legal", "noncharacter_illegal_position": "illegal"}[r["item_type"]]
    draw.text((x + 4, y + cell - 2), f"{r['item_id']} {text} {tag}", fill="black", font=font)
im.save(os.path.join(here, "preview.png"))
