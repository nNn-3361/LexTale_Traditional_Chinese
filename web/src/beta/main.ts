/**
 * Beta test page: runs the test without the server, so the team can try the
 * flow and see how the current item bank performs.
 *
 *   start -> preload -> instructions -> practice with feedback -> test
 *   (random order, 500 ms fixation) -> score and per-item results
 *   -> item analysis over all saved runs, CSV export
 *
 * The trial itself uses the same jsPsych plugin as the real test page
 * (../lexical-decision.ts), so response handling and RT measurement match.
 * Items come from items.json, built from an item set by
 * scripts/prepare-beta-bank.mjs. Nothing is sent to the project's server.
 */
import { initJsPsych } from "jspsych";
import "jspsych/css/jspsych.css";
import HtmlButtonResponsePlugin from "@jspsych/plugin-html-button-response";
import HtmlKeyboardResponsePlugin from "@jspsych/plugin-html-keyboard-response";
import InstructionsPlugin from "@jspsych/plugin-instructions";
import PreloadPlugin from "@jspsych/plugin-preload";

import LexicalDecisionPlugin from "../lexical-decision";
import { text } from "../text";
import { itemCsv, itemStats, isCorrect, parseRawCsv, rawCsv, runScore, type ItemStat } from "./analysis";
import { loadBank, planRun, SET_LABELS, type Bank, type Item, type Plan, type SetChoice } from "./bank";
import type { RunScore } from "./scoring";
import * as store from "./store";
import "./beta.css";

const app = document.getElementById("app")!;
const stage = document.getElementById("stage")!;

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
  stage.hidden = true;
  stage.innerHTML = "";
  app.hidden = false;
  app.innerHTML = html;
  window.scrollTo(0, 0);
}

function header(sub: string) {
  return `
    <header class="top">
      <div>
        <p class="eyebrow">LexTALE 繁體中文 · Beta</p>
        <h1>${sub}</h1>
      </div>
      <nav class="tabs">
        <a href="#" class="${location.hash === "#analysis" ? "" : "on"}">施測 Test</a>
        <a href="#analysis" class="${location.hash === "#analysis" ? "on" : ""}">題目分析 Items</a>
      </nav>
    </header>`;
}

// ---------------------------------------------------------------- start

async function renderStart() {
  const { runs } = await store.loadRuns();
  const nReal = bank.items.filter((i) => i.lexicality === "real").length;
  const labels = [...new Set(runs.map((r) => r.label).filter(Boolean))];
  showPage(`
    ${header("繁體中文字彙測驗 試用版")}
    <main class="grid-start">
      <section class="panel">
        <form id="start-form" class="stack">
          <fieldset class="stack-s">
            <legend>題目範圍 Item set</legend>
            ${(Object.keys(SET_LABELS) as SetChoice[])
              .map(
                (k, n) => `
              <label class="radio"><input type="radio" name="set" id="set-${k}" value="${k}" ${n === 0 ? "checked" : ""}>
                <span>${SET_LABELS[k]}</span></label>`,
              )
              .join("")}
          </fieldset>
          <label class="field" for="label">
            <span>組別（選填）Group (optional)</span>
            <input id="label" name="label" list="label-list" maxlength="40" placeholder="例如 native / learner / team">
            <datalist id="label-list">
              ${["native", "learner", "team", ...labels].filter((v, k, a) => a.indexOf(v) === k).map((l) => `<option value="${esc(l)}">`).join("")}
            </datalist>
            <small class="muted">用來在題目分析中分組比較。請勿輸入姓名或學號。<br>Used to compare groups. Do not enter names or student IDs.</small>
          </label>
          <label class="check"><input type="checkbox" id="practice" checked> <span>先做 4 題練習（有回饋）/ 4 practice items with feedback</span></label>
          <button class="btn primary" type="submit">開始測驗 Start</button>
        </form>
      </section>
      <aside class="stack note">
        <div>
          <h2>這是什麼</h2>
          <p>用預試題庫草稿 <code>${esc(bank.set)}</code>（${bank.items.length} 題：${nReal} 真字、${bank.items.length - nReal} 假字）走一次完整施測流程。題目尚未經人工檢查。</p>
          <p>F 鍵 = 是真字，J 鍵 = 不是真字；手機平板可直接點按鈕。題目順序每次隨機。</p>
        </div>
        <div>
          <h2>資料存在哪裡</h2>
          <p>結果存在這個瀏覽器${"<span data-shared-note></span>"}，不會送到專題的伺服器。可在「題目分析」匯出 CSV。</p>
        </div>
        <p class="muted">已存 ${runs.length} 次作答 / ${runs.length} runs saved. <a href="#analysis">看題目分析</a></p>
      </aside>
    </main>`);
  store.shared().then((db) => {
    const el = app.querySelector("[data-shared-note]");
    if (el && db) el.textContent = "，並與其他開啟此頁的團隊成員共用，讓題目分析可以合併所有人的資料";
  });
  const form = document.getElementById("start-form") as HTMLFormElement;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const choice = (form.querySelector('input[name="set"]:checked') as HTMLInputElement).value as SetChoice;
    const label = (document.getElementById("label") as HTMLInputElement).value.trim();
    const withPractice = (document.getElementById("practice") as HTMLInputElement).checked;
    void startRun(choice, label, withPractice);
  });
}

// ---------------------------------------------------------------- test

async function startRun(choice: SetChoice, label: string, withPractice: boolean) {
  const plan = planRun(bank.items, choice, withPractice);
  app.hidden = true;
  stage.hidden = false;
  stage.innerHTML = "";
  const trials = await runTest(plan);
  const run: store.RunRecord = {
    id: store.newRunId(),
    createdAt: new Date().toISOString(),
    label,
    set: choice,
    bankSet: bank.set,
    practice: plan.practice.map((i) => i.id),
    trials,
  };
  showPage(`${header("儲存中…")}`);
  const saved = await store.saveRun(run);
  renderResult(run, saved);
}

function runTest(plan: Plan): Promise<store.TrialRecord[]> {
  const out: store.TrialRecord[] = [];
  const total = plan.test.length;
  const jsPsych = initJsPsych({
    display_element: stage,
    show_progress_bar: true,
    auto_update_progress_bar: false,
    message_progress_bar: "進度 Progress",
  });
  const fixation = {
    type: HtmlKeyboardResponsePlugin,
    stimulus: '<div class="fixation">+</div>',
    choices: "NO_KEYS",
    trial_duration: 500,
  };
  const decision = (item: Item, practice: boolean) => ({
    type: LexicalDecisionPlugin,
    stimulus: item.image,
    yes_label: text.yes,
    no_label: text.no,
    data: { item: item.id },
    on_finish: (d: { response: "yes" | "no"; rt: number; source: "key" | "button" }) => {
      if (practice) return;
      out.push({ i: item.id, r: d.response, rt: d.rt, s: d.source });
      jsPsych.progressBar!.progress = out.length / total;
    },
  });

  const timeline: unknown[] = [
    {
      type: PreloadPlugin,
      images: [...plan.practice, ...plan.test].map((i) => i.image),
      message: text.preloading,
      error_message: text.preloadError,
      show_detailed_errors: false,
      continue_after_error: false,
    },
    {
      type: InstructionsPlugin,
      pages: text.instructions,
      show_clickable_nav: true,
      button_label_next: text.next,
      button_label_previous: "←",
    },
  ];
  if (plan.practice.length) {
    timeline.push({ type: HtmlButtonResponsePlugin, stimulus: text.practiceStart, choices: [text.go] });
    for (const item of plan.practice) {
      timeline.push(fixation, decision(item, true), {
        type: HtmlKeyboardResponsePlugin,
        stimulus: () => {
          const last = jsPsych.data.get().last(1).values()[0];
          const ok = isCorrect(item, last.response);
          return `<div class="feedback ${ok ? "ok" : "bad"}">${ok ? text.correct : text.wrong}</div>`;
        },
        choices: "NO_KEYS",
        trial_duration: 800,
      });
    }
  }
  timeline.push({
    type: HtmlButtonResponsePlugin,
    stimulus: plan.practice.length ? text.testStart : text.testStartNoPractice,
    choices: [text.go],
  });
  for (const item of plan.test) timeline.push(fixation, decision(item, false));

  return jsPsych.run(timeline as never).then(() => out);
}

// ---------------------------------------------------------------- one run's result

function scoreTiles(s: RunScore) {
  const tile = (label: string, value: string, note: string, main = false) =>
    `<div class="tile ${main ? "main" : ""}"><span class="tl">${label}</span><span class="tv">${value}</span><span class="tn">${note}</span></div>`;
  return `
    <div class="tiles">
      ${tile("平均正確率 LexTALE score", fmt(s.avgPct), "（真字% + 假字%）÷ 2，滿分 100", true)}
      ${tile("真字答對 Real correct", `${s.hits}/${s.realN}`, `${fmt(s.realPct)}%`)}
      ${tile("假字答對 Pseudo correct", `${s.correctRejections}/${s.pseudoN}`, `${fmt(s.pseudoPct)}%，誤答 ${s.falseAlarms}`)}
      ${tile("Ghent 式分數", fmt(s.ghent), `占真字數 ${fmt(s.ghentPct)}%`)}
      ${tile("d′", fmt(s.dPrime, 2), "區辨力")}
      ${tile("平均反應時間 RT", s.meanRtCorrect === null ? "-" : `${Math.round(s.meanRtCorrect)} ms`, "答對的題目")}
    </div>`;
}

const SCORE_NOTES = `
  <details class="formulas">
    <summary>分數怎麼算 How the scores are computed</summary>
    <dl>
      <dt>平均正確率（主要分數）</dt>
      <dd>LexTALE 原版的計分（Lemhöfer &amp; Broersma, 2012）：真字正確率與假字正確率的平均。不受真假字題數比例影響，和系統伺服器的 <code>lextale_avg</code> 相同。</dd>
      <dt>Ghent 式分數</dt>
      <dd>真字答對數 − (真字題數 ÷ 假字題數) × 假字誤答數。真假字 2:1 的測驗通常寫成「真字答對 − 2 × 假字誤答」（待查證）。這份預試題庫是 1:1，所以係數變成 1；只做部分題目時依實際題數計算。</dd>
      <dt>d′</dt>
      <dd>z(真字答「是」的比率) − z(假字答「是」的比率)，比率先做 log-linear 校正（次數 +0.5，題數 +1）。越高表示越能分辨真假字，和作答偏向無關。</dd>
    </dl>
    <p class="muted">正式測驗用哪一種分數，要等預試資料比較後決定（研究計畫 5.6）。</p>
  </details>`;

function renderResult(run: store.RunRecord, saved: store.SaveResult) {
  const s = runScore(run, byId);
  const savedNote = [
    saved.local ? "已存在這個瀏覽器" : "無法存在這個瀏覽器（可能是私密模式），請先下載 CSV",
    saved.shared === true ? "已存到共用資料" : saved.shared === false ? "共用資料儲存失敗，請下載 CSV 保存" : "",
  ]
    .filter(Boolean)
    .join("；");
  const rows = run.trials
    .map((t, k) => {
      const item = byId.get(t.i);
      if (!item) return "";
      const ok = isCorrect(item, t.r);
      return `<tr class="${ok ? "" : "err"}" data-ok="${ok ? 1 : 0}">
        <td class="num">${k + 1}</td><td>${thumb(item)}</td><td><code>${item.id}</code></td>
        <td>${typeChip(item)}</td><td>${itemDesc(item)}</td>
        <td>${t.r === "yes" ? "是" : "不是"}</td>
        <td><span class="mark ${ok ? "ok" : "bad"}">${ok ? "對" : "錯"}</span></td>
        <td class="num">${t.rt}</td></tr>`;
    })
    .join("");
  const nErr = run.trials.filter((t) => byId.has(t.i) && !isCorrect(byId.get(t.i)!, t.r)).length;
  showPage(`
    ${header("你的結果 Your result")}
    <main class="stack">
      <p class="muted">${esc(SET_LABELS[run.set as SetChoice] ?? run.set)}${run.label ? ` · 組別 ${esc(run.label)}` : ""} · ${savedNote}</p>
      ${scoreTiles(s)}
      ${SCORE_NOTES}
      <section class="stack-s">
        <div class="row-between">
          <h2>逐題結果 Per item（${run.trials.length} 題，錯 ${nErr} 題）</h2>
          <div class="row">
            <label class="check"><input type="checkbox" id="only-err"> <span>只看答錯</span></label>
            <button class="btn" id="dl-run">下載 CSV</button>
            <a class="btn" href="#analysis">題目分析</a>
            <button class="btn primary" id="again">再測一次</button>
          </div>
        </div>
        <div class="table-wrap"><table class="items">
          <thead><tr><th>#</th><th>圖</th><th>編號</th><th>類型</th><th>字 / 結構</th><th>作答</th><th>對錯</th><th class="num">RT ms</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </section>
    </main>`);
  document.getElementById("only-err")!.addEventListener("change", (e) => {
    const only = (e.target as HTMLInputElement).checked;
    app.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((tr) => (tr.hidden = only && tr.dataset.ok === "1"));
  });
  document.getElementById("dl-run")!.addEventListener("click", () =>
    store.saveFile(`lextale-beta-run-${run.createdAt.slice(0, 10)}-${run.id.slice(0, 8)}.csv`, rawCsv([run], byId)).catch(console.error),
  );
  document.getElementById("again")!.addEventListener("click", () => void renderStart());
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
  const loaded = await store.loadRuns();
  if (location.hash !== "#analysis") return;
  const all = loaded.runs;
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
  const sharedNote =
    loaded.sharedCount === null
      ? "只有這個瀏覽器的資料"
      : loaded.sharedCount < 0
        ? "共用資料讀取失敗，只顯示這個瀏覽器的資料"
        : `共用資料 ${loaded.sharedCount} 次，這個瀏覽器 ${loaded.localCount} 次`;

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
          : `<div class="empty"><p>還沒有作答資料。先到「施測」做一次，或匯入別人下載的原始作答 CSV。</p><p class="muted">No runs yet. Take the test, or import a raw CSV exported by a teammate.</p></div>`
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

// ---------------------------------------------------------------- routing

function route() {
  if (!stage.hidden) return; // never leave a running test
  if (location.hash === "#analysis") void renderAnalysis();
  else void renderStart();
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
  window.addEventListener("hashchange", route);
  route();
}

void main();
