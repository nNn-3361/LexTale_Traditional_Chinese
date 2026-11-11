"""Select the 60 real characters of the pilot draft set.

Inputs (not stored in this repository; see README.md for where to get them):
  --moe-dir   folder with the four MOE character frequency CSV files for 2012-2015
              (民國101-104年常用語詞調查語料統計分析字頻表)
  --unihan    unihan.db (SQLite) from the npm package cjk-unihan 0.0.3
  --ids       ids.txt from cjkvi-ids

Output: real_selection.csv (written next to this script).

Procedure
1. Pool the character counts of the four yearly corpora; per million = count / total * 1e6.
2. Keep characters that are in Big5 and in CNS 11643 plane 1 or 2 (Unihan kIRG_TSource T1/T2),
   that have a left-right (⿰) or top-bottom (⿱) structure in cjkvi-ids (same as the pseudo-characters),
   and 6 to 20 strokes (Unihan kTotalStrokes).
3. Drop a character when a semantic or Z variant of it is more frequent in the corpus
   (usually a non-standard form). In the <1 band, require at least 2 occurrences in at least
   2 of the 4 years, to reduce typos and one-off names.
4. Within each frequency band and structure, shuffle with a fixed seed and take characters in that
   order, skipping the hand exclusions listed in EXCLUDE, until the quota is met.
"""

import argparse
import csv
import glob
import os
import random
import re
import sqlite3

SEED = 20261111
# band label, lower bound (inclusive), upper bound (exclusive), per million
BANDS = [(">100", 100, 1e12), ("20-100", 20, 100), ("10-20", 10, 20), ("5-10", 5, 10), ("1-5", 1, 5), ("<1", 0, 1)]
# (left-right, top-bottom) count per band. Band totals follow LEXTALE_CH (Chan & Chang, 2018).
QUOTA = {">100": (2, 1), "20-100": (5, 2), "10-20": (8, 4), "5-10": (5, 3), "1-5": (9, 4), "<1": (11, 6)}
# Characters skipped by hand during selection, with the reason.
EXCLUDE = {
    "邢": "used almost only as a surname or place name",
    "琇": "used almost only in given names",
    "滇": "used almost only as a place name (Yunnan)",
    "赤": "not visually split into two components",
    "奏": "not visually split into two components",
}


def band_of(pm):
    for name, lo, hi in BANDS:
        if lo <= pm < hi:
            return name


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--moe-dir", required=True)
    ap.add_argument("--unihan", required=True)
    ap.add_argument("--ids", required=True)
    args = ap.parse_args()

    counts, totals = {}, {}
    files = sorted(glob.glob(os.path.join(args.moe_dir, "*字頻表-附錄*.csv")))
    assert len(files) == 4, files
    for f in files:
        year = re.search(r"民國(\d+)年", os.path.basename(f)).group(1)
        with open(f, encoding="utf-8-sig", newline="") as fh:
            rows = csv.reader(fh)
            next(rows)
            t = 0
            for row in rows:
                if len(row) < 3 or not row[1].strip():
                    continue
                n = int(row[2].replace(",", "").strip())
                counts.setdefault(row[1].strip(), {})[year] = n
                t += n
            totals[year] = t
    total = sum(totals.values())
    years = sorted(totals)

    uni = {}
    db = sqlite3.connect(f"file:{args.unihan}?mode=ro", uri=True)
    for ch, strokes, big5, tsrc, sv, zv in db.execute(
        "select character, kTotalStrokes, kBigFive, kIRG_TSource, kSemanticVariant, kZVariant from unihan"
    ):
        uni[ch] = (strokes, big5, tsrc, " ".join(filter(None, [sv, zv])))

    ids = {}
    with open(args.ids, encoding="utf-8") as fh:
        for line in fh:
            p = line.rstrip("\n").split("\t")
            if not line.startswith("#") and len(p) >= 3:
                ids[p[1]] = re.sub(r"\[[^\]]*\]", "", p[2])

    pools = {}
    for ch in sorted(counts):
        n = sum(counts[ch].values())
        pm = n / total * 1e6
        strokes, big5, tsrc, var = uni.get(ch, (None, None, None, ""))
        if not big5 or not tsrc or tsrc[:2] not in ("T1", "T2"):
            continue
        struct = ids.get(ch, "")[:1]
        if struct not in ("⿰", "⿱"):
            continue
        try:
            strokes = int(str(strokes).split()[0])
        except (TypeError, ValueError):
            continue
        if not 6 <= strokes <= 20:
            continue
        band = band_of(pm)
        if band == "<1" and (n < 2 or len(counts[ch]) < 2):
            continue
        variants = [chr(int(t.split("<")[0][2:], 16)) for t in var.split() if t.startswith("U+")]
        if any(sum(counts.get(v, {}).values()) > n for v in variants if v != ch):
            continue
        pools.setdefault((band, struct), []).append(
            dict(char=ch, band=band, structure=struct, ids=ids[ch], strokes=strokes, cns=tsrc[:2],
                 count=n, per_million=round(pm, 3), **{f"count_{y}": counts[ch].get(y, 0) for y in years})
        )

    rng = random.Random(SEED)
    out, skipped = [], []
    for band, _, _ in BANDS:
        for k, struct in enumerate("⿰⿱"):
            pool = pools[(band, struct)][:]
            rng.shuffle(pool)
            taken = 0
            for row in pool:
                if taken == QUOTA[band][k]:
                    break
                if row["char"] in EXCLUDE:
                    skipped.append(row["char"])
                    continue
                out.append(row)
                taken += 1
            assert taken == QUOTA[band][k], (band, struct)
    assert sorted(skipped) == sorted(EXCLUDE), (skipped, list(EXCLUDE))

    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "real_selection.csv")
    with open(path, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(out[0]))
        w.writeheader()
        w.writerows(out)
    print(f"corpus tokens {total} ({', '.join(f'{y}: {totals[y]}' for y in years)}); wrote {len(out)} rows to {path}")


if __name__ == "__main__":
    main()
