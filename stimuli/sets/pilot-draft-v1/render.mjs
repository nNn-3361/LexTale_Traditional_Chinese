// Render the pilot draft set with the pseudo-character maker.
//
// The script opens stimuli/tools/pseudo-character-maker/index.html in headless Chromium and
// uses the tool's own controls: for each pseudo-character it sets the structure, the two source
// characters and the kept halves, lets the tool find the cuts (or applies the cut and cut mode
// given in pseudo_recipes.csv), and adds it to the list; then it adds the real characters and downloads
// the ZIP (PNG + items.csv) with the Serif font, 400 px and a transparent background.
// The final items.csv adds the frequency band and item type columns from real_selection.csv
// and pseudo_recipes.csv.
//
// Usage (from this folder, with Playwright installed):
//   node render.mjs --font /path/to/SourceHanSerifTC-Regular.otf --jszip /path/to/jszip.min.js
//
// The font is served to the page in place of Google Fonts' Noto Serif TC, so the images use the
// pinned Source Han Serif TC file. JSZip is the npm package jszip@3.10.1 (dist/jszip.min.js).

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const tool = resolve(here, '../../tools/pseudo-character-maker/index.html');
const FONT_LABEL = 'Source Han Serif TC 2.003';

const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const fontPath = arg('font'), jszipPath = arg('jszip');
if (!fontPath || !jszipPath) { console.error('usage: node render.mjs --font <otf> --jszip <jszip.min.js>'); process.exit(2); }

function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const toCsv = rows => {
  const cols = Object.keys(rows[0]);
  const esc = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  return '﻿' + [cols, ...rows.map(r => cols.map(c => r[c] ?? ''))].map(r => r.map(esc).join(',')).join('\n') + '\n';
};

const real = parseCsv(readFileSync(join(here, 'real_selection.csv'), 'utf8'));
const pseudo = parseCsv(readFileSync(join(here, 'pseudo_recipes.csv'), 'utf8'));

const browser = await chromium.launch();
const page = await browser.newPage({ acceptDownloads: true });
// Serve the pinned font as "Noto Serif TC", the family the tool asks for, and JSZip from a local copy.
await page.route('https://fonts.googleapis.com/**', r => r.fulfill({
  contentType: 'text/css',
  body: '@font-face{font-family:"Noto Serif TC";font-weight:400;src:url("https://local.font/serif.otf") format("opentype")}',
}));
await page.route('https://local.font/serif.otf', r => r.fulfill({ contentType: 'font/otf', body: readFileSync(fontPath) }));
await page.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: readFileSync(jszipPath) }));

await page.goto('file://' + tool);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.selectOption('#font', 'serif');
await page.selectOption('#size', '400');
await page.selectOption('#bg', 'clear');
await page.evaluate(() => document.fonts.ready);

const SIDE = { left: 'first', top: 'first', right: 'second', bottom: 'second' };
for (const p of pseudo) {
  await page.click(p.structure === '⿰' ? '#st-lr' : '#st-tb');
  await page.fill('#inA', p.source_a);
  await page.fill('#inB', p.source_b);
  await page.evaluate(t => document.fonts.load('400 64px "Noto Serif TC"', t), p.source_a + p.source_b);
  await page.click('#auto'); // automatic cut after the font has loaded
  await page.selectOption('#sideA', SIDE[p.keep_a]);
  await page.selectOption('#sideB', SIDE[p.keep_b]);
  await page.setChecked('#cutStroke', (p.cut_mode || 'stroke') === 'stroke');
  for (const [k, id] of [['cut_a', '#cutA'], ['cut_b', '#cutB']]) {
    if (p[k]) await page.$eval(id, (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }, p[k]);
  }
  p.warning = await page.$eval('#cutWarn', el => el.textContent.trim());
  await page.click('#addPseudo');
}
await page.fill('#inReal', real.map(r => r.char).join(''));
await page.click('#addReal');
await page.waitForFunction(n => document.querySelectorAll('.item').length === n, real.length + pseudo.length);

const [download] = await Promise.all([page.waitForEvent('download'), page.click('#zip')]);
const JSZip = require(resolve(jszipPath));
const zip = await JSZip.loadAsync(readFileSync(await download.path()));
await browser.close();

const imgDir = join(here, 'images');
rmSync(imgDir, { recursive: true, force: true }); mkdirSync(imgDir);
const toolRows = parseCsv(await zip.file('items.csv').async('string'));
for (const r of toolRows) writeFileSync(join(imgDir, r.image), await zip.file(r.image).async('nodebuffer'));

// The tool numbers pseudo-characters P001... and real characters R001... in the order they were added,
// which is the order of the two input files.
const out = toolRows.map(r => {
  const isReal = r.lexicality === 'real';
  const src = isReal ? real[+r.item_id.slice(1) - 1] : pseudo[+r.item_id.slice(1) - 1];
  if (isReal ? src.char !== r.char : src.item_id !== r.item_id) throw new Error('order mismatch at ' + r.item_id);
  return {
    ...r,
    font: FONT_LABEL,
    batch: src.batch,
    item_type: isReal ? 'real' : src.pseudo_type === 'legal' ? 'pseudo_legal_position' : 'noncharacter_illegal_position',
    freq_band: isReal ? src.band : '',
    per_million: isReal ? src.per_million : '',
    corpus_count: isReal ? src.count : '',
    ids: src.ids,
    strokes: isReal ? src.strokes : '',
    // the tool's warning that a cut went straight through touching strokes, as "A", "B" or "A;B"
    straight_cut_in: isReal ? '' : ['A', 'B'].filter(k => src.warning.includes(k + '「')).join(';'),
    review_status: 'pending',
  };
});
writeFileSync(join(here, 'items.csv'), toCsv(out));
console.log(`wrote ${out.length} items and images to ${here}`);
for (const p of pseudo) if (p.warning) console.log(`${p.item_id}: ${p.warning}`);
