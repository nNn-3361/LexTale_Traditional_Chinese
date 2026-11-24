/**
 * Item analysis page (analysis.html), published next to the pilot page.
 *
 * Runs are read from the pilot results sheet (trials tab, without participant
 * codes) through the Apps Script web app each time the page opens, so anyone
 * with the link sees the latest data. Runs taken or imported (raw CSV) in this
 * browser are included too. Shown per item: percent correct, percent "yes",
 * mean RT and point-biserial discrimination, with filters and CSV export.
 *
 * This page replaces the beta page (removed 2026-11-23, team decision); the
 * test itself is the pilot page (pilot.ts).
 */
import { itemCsv, itemStats, parseRawCsv, rawCsv, runScore, type ItemStat } from "./analysis";
import { loadBank, type Bank, type Item } from "./bank";
import * as store from "./store";
import { fetchSheetRuns } from "./sheets";
import "./beta.css";
import "./ink.css";
import { installInkFx } from "./ink-fx";

const app = document.getElementById("app")!;
installInkFx(app);

let bank: Bank;
let byId: Map<string, Item>;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = (v: number | null, d = 1) => (v === null || Number.isNaN(v) ? "-" : v.toFixed(d));

const TYPE_LABELS: Record<string, string> = {
  real: "真字",
  pseudo_legal_position: "假字 合規",
  noncharacter_illegal_position: "非字 錯位",
};
const typeChip = (i: Item) => `<span class="chip t-${i.lexicality}">${TYPE_LABELS[i.type] ?? i.type}</span>`;
const thumb = (i: Item, size = 44) =>
  `<img class="thumb" src="${i.image}" width="${size}" height="${size}" alt="${esc(i.char || i.ids || i.id)}" loading="lazy">`;
// IDS operators (such as U+2FF0) are missing from many fonts, so show the structure as a word.
const STRUCTURE: Record<string, string> = { "\u2FF0": "左右", "\u2FF1": "上下" };
const structure = (i: Item) => {
  const op = [...i.ids][0] ?? "";
  return STRUCTURE[op] ? `${STRUCTURE[op]} <span class="han">${esc([...i.ids].slice(1).join(""))}</span>` : esc(i.ids);
};
const itemDesc = (i: Item) =>
  i.lexicality === "real"
    ? `<span class="han">${esc(i.char)}</span> <span class="muted">${esc(i.band)}/M</span>`
    : `${structure(i)} <span class="muted">(${esc(i.sources)})</span>`;

function showPage(html: string) {
  app.innerHTML = html;
  window.scrollTo(0, 0);
}

function header(sub: string) {
  return `
    <header class="top">
      <div>
        <p class="eyebrow">LexTALE 繁體中文 · 研究人員用</p>
        <h1>${sub}<span class="seal" aria-hidden="true">字</span></h1>
      </div>
      <nav class="tabs">
        <a href="./">前導測驗 Test</a>
        <a href="analysis.html" class="on">題目分析 Items</a>
      </nav>
    </header>`;
}

// ---------------------------------------------------------------- item analysis

interface Filters {
  label: string;
  type: string;
  batch: string;
  sort: string;
  flagged: boolean;
}
const filters: Filters = { label: "", type: "", batch: "", sort: "pct", flagged: false };

function band(s: ItemStat): "bad" | "warn" | "ok" | "none" {
  if (s.pct === null || s.n < 3) return "none";
  if (s.pct < 50) return "bad";
  if (s.pct < 75) return "warn";
  return "ok";
}

async function renderAnalysis() {
  showPage(`${header("題目分析 Item analysis")}<main><p class="muted">讀取中… Loading…</p></main>`);
  const [loaded, sheet] = await Promise.all([store.loadRuns(), fetchSheetRuns()]);
  const sheetRuns = Array.isArray(sheet) ? sheet : [];
  // Runs from the results sheet first; a run also kept in this browser replaces the sheet copy.
  const merged = new Map(sheetRuns.map((r) => [r.id, r]));
  for (const r of loaded.runs) merged.set(r.id, r);
  const all = [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const labels = [...new Set(all.map((r) => r.label || ""))].sort();
  const runs = all.filter((r) => !filters.label || (r.label || "(none)") === filters.label);
  const stats = itemStats(runs, bank.items);
  let shown = stats.filter(
    (s) =>
      (!filters.type || s.item.type === filters.type) &&
      (!filters.batch || String(s.item.batch) === filters.batch) &&
      (!filters.flagged || band(s) === "bad" || band(s) === "warn"),
  );
  const cmp: Record<string, (a: ItemStat, b: ItemStat) => number> = {
    // Items with fewer than 3 answers go last.
    pct: (a, b) => (a.n >= 3 ? a.pct! : 101 + (a.pct ?? 1)) - (b.n >= 3 ? b.pct! : 101 + (b.pct ?? 1)),
    id: (a, b) => a.item.id.localeCompare(b.item.id),
    rpb: (a, b) => (a.rpb ?? 2) - (b.rpb ?? 2),
    rt: (a, b) => (b.meanRt ?? -1) - (a.meanRt ?? -1),
  };
  shown = shown.slice().sort(cmp[filters.sort] ?? cmp.pct);

  const counts = { bad: 0, warn: 0, ok: 0, none: 0 };
  for (const s of stats) counts[band(s)]++;
  const sheetNote =
    sheet === null
      ? "未設定結果試算表"
      : sheet === "failed"
        ? "結果試算表讀取失敗"
        : sheet === "old-script"
          ? "結果試算表的 Apps Script 需要重新部署才能自動讀取"
          : `結果試算表 ${sheet.length} 次`;
  const sharedNote = `${sheetNote}，這個瀏覽器 ${loaded.localCount} 次${
    loaded.sharedCount !== null && loaded.sharedCount >= 0 ? `，共用資料 ${loaded.sharedCount} 次` : ""
  }`;

  const runRows = runs
    .slice()
    .reverse()
    .map((r) => {
      const s = runScore(r, byId);
      return `<tr><td>${esc(r.createdAt.slice(0, 16).replace("T", " "))}</td><td>${esc(r.label || "-")}</td><td>${esc(r.set)}</td>
        <td class="num">${r.trials.length}</td><td class="num">${fmt(s.avgPct)}</td><td class="num">${fmt(s.realPct)}</td>
        <td class="num">${fmt(s.pseudoPct)}</td><td class="num">${fmt(s.dPrime, 2)}</td></tr>`;
    })
    .join("");

  const itemRows = shown
    .map((s) => {
      const b = band(s);
      return `<tr>
        <td>${thumb(s.item)}</td><td><code>${s.item.id}</code><br><span class="muted">批 ${s.item.batch ?? "-"}</span></td>
        <td>${typeChip(s.item)}</td><td>${itemDesc(s.item)}</td>
        <td class="num">${s.n}</td>
        <td><div class="acc"><div class="bar b-${b}"><span style="width:${s.pct ?? 0}%"></span></div><span class="num">${fmt(s.pct, 0)}%</span></div></td>
        <td class="num">${fmt(s.yesPct, 0)}%</td>
        <td class="num">${s.meanRt === null ? "-" : Math.round(s.meanRt)}</td>
        <td class="num ${s.rpb !== null && s.rpb < 0.1 ? "low" : ""}">${fmt(s.rpb, 2)}</td>
      </tr>`;
    })
    .join("");

  const opt = (v: string, label: string, cur: string) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(label)}</option>`;
  showPage(`
    ${header("題目分析 Item analysis")}
    <main class="stack">
      <p class="muted">${all.length} 次作答（${sharedNote}）。正確率以「真字答是、假字答不是」為對。作答少於 3 次的題目不標色。</p>
      <div class="summary">
        <span class="pill b-bad">正確率 &lt; 50%：${counts.bad} 題</span>
        <span class="pill b-warn">50–75%：${counts.warn} 題</span>
        <span class="pill b-ok">≥ 75%：${counts.ok} 題</span>
        <span class="pill b-none">資料不足：${counts.none} 題</span>
      </div>
      <div class="filters">
        <label class="field" for="f-label"><span>組別</span><select id="f-label">${opt("", "全部 All", filters.label)}${labels
          .map((l) => opt(l || "(none)", l || "(未填)", filters.label))
          .join("")}</select></label>
        <label class="field" for="f-type"><span>類型</span><select id="f-type">${opt("", "全部 All", filters.type)}${Object.entries(TYPE_LABELS)
          .map(([k, v]) => opt(k, v, filters.type))
          .join("")}</select></label>
        <label class="field" for="f-batch"><span>批次</span><select id="f-batch">${opt("", "全部 All", filters.batch)}${opt("1", "第一批", filters.batch)}${opt("2", "第二批", filters.batch)}</select></label>
        <label class="field" for="f-sort"><span>排序</span><select id="f-sort">${opt("pct", "正確率低到高", filters.sort)}${opt("rpb", "鑑別度低到高", filters.sort)}${opt("rt", "反應時間長到短", filters.sort)}${opt("id", "編號", filters.sort)}</select></label>
        <label class="check"><input type="checkbox" id="f-flagged" ${filters.flagged ? "checked" : ""}> <span>只看 &lt; 75%</span></label>
      </div>
      <div class="row">
        <button class="btn" id="dl-items" ${runs.length ? "" : "disabled"}>下載逐題統計 CSV</button>
        <button class="btn" id="dl-raw" ${runs.length ? "" : "disabled"}>下載原始作答 CSV</button>
        <label class="btn" for="import">匯入原始作答 CSV<input type="file" id="import" accept=".csv,text/csv" hidden></label>
        <span id="clear-wrap"><button class="btn subtle" id="clear" ${loaded.localCount ? "" : "disabled"}>清除這個瀏覽器的資料</button></span>
        <span class="muted" id="msg" role="status"></span>
      </div>
      ${
        runs.length
          ? ""
          : `<div class="empty"><p>還沒有作答資料。資料會自動從結果試算表讀取；也可以匯入從 trials 分頁下載的 CSV。</p><p class="muted">No runs yet. Data is read from the results sheet automatically; you can also import a CSV of its trials tab.</p></div>`
      }
      <details class="runs" ${runs.length ? "" : "hidden"}>
        <summary>各次作答分數 Runs (${runs.length})</summary>
        <div class="table-wrap"><table>
          <thead><tr><th>時間 (UTC)</th><th>組別</th><th>範圍</th><th class="num">題數</th><th class="num">平均%</th><th class="num">真字%</th><th class="num">假字%</th><th class="num">d′</th></tr></thead>
          <tbody>${runRows}</tbody></table></div>
      </details>
      <div class="table-wrap" ${runs.length ? "" : "hidden"}><table class="items">
        <thead><tr><th>圖</th><th>編號</th><th>類型</th><th>字 / 結構</th><th class="num">次數</th><th>正確率</th><th class="num">答「是」</th><th class="num">RT ms</th><th class="num" title="點二系列相關：答對此題與整體分數的相關">鑑別度 r<sub>pb</sub></th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table></div>
      <p class="muted">鑑別度 r<sub>pb</sub>：答對這題與該次平均正確率的點二系列相關（含本題），至少 3 次作答才計算。接近 0 或負值表示這題沒有區分程度高低的作用。資料少時數值不穩定，僅供參考。</p>
    </main>`);

  const bind = (id: keyof Filters, el: string) =>
    document.getElementById(el)!.addEventListener("change", (e) => {
      const t = e.target as HTMLInputElement;
      (filters as unknown as Record<string, unknown>)[id] = t.type === "checkbox" ? t.checked : t.value;
      void renderAnalysis();
    });
  bind("label", "f-label");
  bind("type", "f-type");
  bind("batch", "f-batch");
  bind("sort", "f-sort");
  bind("flagged", "f-flagged");
  const msg = document.getElementById("msg")!;
  const stamp = new Date().toISOString().slice(0, 10);
  document.getElementById("dl-items")!.addEventListener("click", () =>
    store.saveFile(`lextale-beta-items-${stamp}.csv`, itemCsv(stats)).catch(console.error),
  );
  document.getElementById("dl-raw")!.addEventListener("click", () =>
    store.saveFile(`lextale-beta-raw-${stamp}.csv`, rawCsv(runs, byId)).catch(console.error),
  );
  document.getElementById("import")!.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const n = store.importRuns(parseRawCsv(await file.text()));
      msg.textContent = `匯入 ${n} 次新的作答。`;
      setTimeout(() => void renderAnalysis(), 900);
    } catch (err) {
      msg.textContent = `無法匯入：${(err as Error).message}。請用本頁下載的「原始作答 CSV」。`;
    }
  });
  document.getElementById("clear")!.addEventListener("click", () => {
    document.getElementById("clear-wrap")!.innerHTML = `
      <span>確定清除這個瀏覽器的 ${loaded.localCount} 次作答？共用資料不受影響。</span>
      <button class="btn danger" id="clear-yes">清除</button><button class="btn" id="clear-no">取消</button>`;
    document.getElementById("clear-yes")!.addEventListener("click", () => {
      store.clearLocal();
      void renderAnalysis();
    });
    document.getElementById("clear-no")!.addEventListener("click", () => void renderAnalysis());
  });
}

async function main() {
  try {
    bank = await loadBank();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<main class="stack"><p>題庫載入失敗，請重新整理頁面。</p><p class="muted">The item bank could not be loaded. Reload the page.</p></main>`;
    return;
  }
  byId = new Map(bank.items.map((i) => [i.id, i]));
  void renderAnalysis();
}

void main();
