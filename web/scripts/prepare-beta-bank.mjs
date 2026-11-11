// Builds the static item bank for the beta (offline) test page.
//
// Reads an item set made by the pseudo-character maker (items.csv + images/)
// and writes web/.beta-bank/items.json and web/.beta-bank/images/*.png.
// The output is generated and not committed (see .gitignore).
//
// Usage: node scripts/prepare-beta-bank.mjs [path/to/set]
// Default set: stimuli/sets/pilot-draft-v1
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const setDir = resolve(process.argv[2] ?? join(webDir, "..", "stimuli", "sets", "pilot-draft-v1"));
const outDir = join(webDir, ".beta-bank");

const csv = readFileSync(join(setDir, "items.csv"), "utf8").replace(/^﻿/, "");
const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
// The item CSVs have no quoted fields; refuse anything that does rather than misread it.
if (lines.some((l) => l.includes('"'))) throw new Error("items.csv has quoted fields; this script does not parse them");
const header = lines[0].split(",");
const rows = lines.slice(1).map((l) => {
  const cells = l.split(",");
  if (cells.length !== header.length) throw new Error(`Wrong number of columns: ${l}`);
  return Object.fromEntries(header.map((h, i) => [h, cells[i]]));
});

const num = (v) => (v === undefined || v === "" ? null : Number(v));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "images"), { recursive: true });

const items = rows.map((r) => {
  if (r.lexicality !== "real" && r.lexicality !== "pseudo") throw new Error(`Bad lexicality for ${r.item_id}`);
  const src = join(setDir, "images", r.image);
  if (!existsSync(src)) throw new Error(`Missing image ${src}`);
  copyFileSync(src, join(outDir, "images", basename(r.image)));
  return {
    id: r.item_id,
    lexicality: r.lexicality,
    type: r.item_type || r.lexicality,
    batch: num(r.batch),
    band: r.freq_band || "",
    perMillion: num(r.per_million),
    char: r.char || "",
    sources: r.lexicality === "pseudo" ? [r.source_a, r.source_b].filter(Boolean).join("+") : "",
    ids: r.ids || "",
    strokes: num(r.strokes),
    review: r.review_status || "",
    image: `images/${basename(r.image)}`,
  };
});

writeFileSync(
  join(outDir, "items.json"),
  JSON.stringify({ set: basename(setDir), generated: new Date().toISOString(), items }, null, 1),
);
const n = (lex) => items.filter((i) => i.lexicality === lex).length;
console.log(`${items.length} items (${n("real")} real, ${n("pseudo")} pseudo) from ${setDir} -> ${outDir}`);
