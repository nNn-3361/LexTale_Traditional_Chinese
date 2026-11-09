"""Make a placeholder item bank for development and tests.

The images only show text such as "DEMO real 01". They are not real stimuli
and must never be used with participants. Output uses the same items.csv
format as stimuli/tools/pseudo-character-maker.

    python scripts/make_demo_bank.py OUT_DIR [--real 6] [--pseudo 4]
"""

import argparse
import csv
from pathlib import Path

from PIL import Image, ImageDraw

# Placeholder values for the char column of demo real items.
DEMO_CHARS = "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥"


def make(out: Path, n_real: int, n_pseudo: int, size: int = 256) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    for lex, n, prefix in (("real", n_real, "R"), ("pseudo", n_pseudo, "P")):
        for i in range(1, n + 1):
            code = f"DEMO-{prefix}{i:02d}"
            img = Image.new("RGB", (size, size), "white")
            d = ImageDraw.Draw(img)
            d.rectangle([4, 4, size - 5, size - 5], outline="black", width=3)
            d.text((size // 2, size // 2), f"DEMO {lex} {i:02d}", fill="black", anchor="mm",
                   font_size=size // 9)
            name = f"{code}.png"
            img.save(out / name)
            rows.append({
                "item_id": code,
                "lexicality": lex,
                "char": DEMO_CHARS[(i - 1) % len(DEMO_CHARS)] if lex == "real" else "",
                "structure": "",
                "font": "demo",
                "image": name,
            })
    csv_path = out / "items.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    return csv_path


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("out", type=Path)
    p.add_argument("--real", type=int, default=6)
    p.add_argument("--pseudo", type=int, default=4)
    a = p.parse_args()
    print(make(a.out, a.real, a.pseudo))
