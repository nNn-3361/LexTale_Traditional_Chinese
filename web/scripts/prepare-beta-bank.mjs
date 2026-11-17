// Builds the static item bank for the beta (offline) test page.
//
// Reads an item set made by the pseudo-character maker (items.csv + images/)
// and writes web/.beta-bank/items.json and web/.beta-bank/images/*.png.
// The output is generated and not committed (see .gitignore).
//
// Usage: node scripts/prepare-beta-bank.mjs [path/to/set]
// Default set: stimuli/sets/pilot-v2
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const setDir = resolve(process.argv[2] ?? join(webDir, "..", "stimuli", "sets", "pilot-v2"));
const outDir = join(webDir, ".beta-bank");

if (!existsSync(join(setDir, "items.csv"))) {
  throw new Error(`No item set at ${setDir}: add items.csv and images/ there, or pass the set folder as an argument`);
}

const csv = readFileSync(join(setDir, "items.csv"), "utf8").replace(/^\uFEFF/, "");

// Parses CSV with quoted fields ("..." with "" for a quote), as the
// pseudo-character maker writes them (its crop and move columns hold JSON with commas).
function parseCsv(text) {
  const out = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); out.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("items.csv has an unclosed quote");
  if (cell !== "" || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((v) => v.trim() !== ""));
}

const [header, ...body] = parseCsv(csv);
const rows = body.map((cells) => {
  if (cells.length !== header.length) throw new Error(`Wrong number of columns: ${cells.join(",")}`);
  return Object.fromEntries(header.map((h, i) => [h, cells[i]]));
});

// Images are read from images/ in the set folder, or from the set folder itself
// (the layout of the pseudo-character maker's ZIP).
const imageDir = existsSync(join(setDir, "images")) ? join(setDir, "images") : setDir;

const num = (v) => (v === undefined || v === "" ? null : Number(v));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "images"), { recursive: true });

const items = rows.map((r) => {
  if (r.lexicality !== "real" && r.lexicality !== "pseudo") throw new Error(`Bad lexicality for ${r.item_id}`);
  const src = join(imageDir, basename(r.image));
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
