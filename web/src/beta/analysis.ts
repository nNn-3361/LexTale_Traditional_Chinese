/** Per-item statistics over many runs, and CSV import/export. */
import type { Item } from "./bank";
import { correlation, scoreRun, type RunScore } from "./scoring";
import type { RunRecord, TrialRecord } from "./store";

export const isCorrect = (item: Item, r: "yes" | "no") => (item.lexicality === "real") === (r === "yes");

export function runScore(run: RunRecord, items: Map<string, Item>): RunScore {
  return scoreRun(
    run.trials
      .filter((t) => items.has(t.i))
      .map((t) => ({ lexicality: items.get(t.i)!.lexicality, response: t.r, rt: t.rt })),
  );
}

export interface ItemStat {
  item: Item;
  n: number;
  correct: number;
  /** Percent correct; null if n = 0. */
  pct: number | null;
  /** Percent of "yes" answers. */
  yesPct: number | null;
  /** Mean RT of correct answers, ms. */
  meanRt: number | null;
  /**
   * Point-biserial correlation between getting this item right and the run's
   * averaged score (item included). Null with fewer than 3 runs or no variance.
   */
  rpb: number | null;
}

export function itemStats(runs: RunRecord[], items: Item[]): ItemStat[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const scores = runs.map((r) => runScore(r, byId).avgPct);
  const acc = new Map<string, { c: number[]; s: number[]; yes: number; rts: number[] }>();
  for (const i of items) acc.set(i.id, { c: [], s: [], yes: 0, rts: [] });
  runs.forEach((run, k) => {
    for (const t of run.trials) {
      const item = byId.get(t.i);
      const a = acc.get(t.i);
      if (!item || !a) continue;
      const ok = isCorrect(item, t.r);
      a.c.push(ok ? 1 : 0);
      a.s.push(scores[k]);
      if (t.r === "yes") a.yes++;
      if (ok) a.rts.push(t.rt);
    }
  });
  return items.map((item) => {
    const a = acc.get(item.id)!;
    const n = a.c.length;
    const correct = a.c.reduce((s, v) => s + v, 0);
    return {
      item,
      n,
      correct,
      pct: n ? (100 * correct) / n : null,
      yesPct: n ? (100 * a.yes) / n : null,
      meanRt: a.rts.length ? a.rts.reduce((s, v) => s + v, 0) / a.rts.length : null,
      rpb: correlation(a.c, a.s),
    };
  });
}

// ---- CSV ----

const RAW_COLUMNS = [
  "run_id",
  "created_at",
  "label",
  "set",
  "bank_set",
  "position",
  "item_id",
  "lexicality",
  "item_type",
  "response",
  "correct",
  "rt_ms",
  "source",
  "participant_code",
] as const;
/** Columns that older files may lack. */
const OPTIONAL_COLUMNS = new Set<string>(["participant_code"]);

function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const BOM = "﻿"; // so Excel opens the file as UTF-8

/** One row per test trial. */
export function rawCsv(runs: RunRecord[], items: Map<string, Item>): string {
  const lines = [RAW_COLUMNS.join(",")];
  for (const run of runs) {
    run.trials.forEach((t, pos) => {
      const item = items.get(t.i);
      lines.push(
        [
          run.id,
          run.createdAt,
          run.label,
          run.set,
          run.bankSet,
          pos + 1,
          t.i,
          item?.lexicality ?? "",
          item?.type ?? "",
          t.r,
          item ? (isCorrect(item, t.r) ? 1 : 0) : "",
          t.rt,
          t.s,
          run.participant ?? "",
        ]
          .map(cell)
          .join(","),
      );
    });
  }
  return BOM + lines.join("\r\n") + "\r\n";
}

const f = (v: number | null, d: number) => (v === null ? "" : v.toFixed(d));

/** One row per item. */
export function itemCsv(stats: ItemStat[]): string {
  const lines = [
    "item_id,lexicality,item_type,batch,char,sources,ids,freq_band,per_million,strokes,n,correct,pct_correct,pct_yes,mean_rt_correct_ms,r_pb",
  ];
  for (const s of stats) {
    const i = s.item;
    lines.push(
      [
        i.id,
        i.lexicality,
        i.type,
        i.batch,
        i.char,
        i.sources,
        i.ids,
        i.band,
        i.perMillion,
        i.strokes,
        s.n,
        s.correct,
        f(s.pct, 1),
        f(s.yesPct, 1),
        f(s.meanRt, 0),
        f(s.rpb, 3),
      ]
        .map(cell)
        .join(","),
    );
  }
  return BOM + lines.join("\r\n") + "\r\n";
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

/** Reads a file written by rawCsv back into runs. Throws if the columns do not match. */
export function parseRawCsv(text: string): RunRecord[] {
  const [head, ...rows] = parseCsv(text);
  const col = (name: string) => {
    const k = head?.indexOf(name) ?? -1;
    if (k < 0 && !OPTIONAL_COLUMNS.has(name)) throw new Error(`Column ${name} not found`);
    return k;
  };
  const c = Object.fromEntries(RAW_COLUMNS.map((n) => [n, col(n)])) as Record<(typeof RAW_COLUMNS)[number], number>;
  const runs = new Map<string, RunRecord & { pos: number[] }>();
  for (const r of rows) {
    const id = r[c.run_id];
    const response = r[c.response];
    const source = r[c.source];
    if (!id || (response !== "yes" && response !== "no")) continue;
    let run = runs.get(id);
    if (!run) {
      run = {
        id,
        createdAt: r[c.created_at],
        label: r[c.label],
        set: (r[c.set] as RunRecord["set"]) || "import",
        bankSet: r[c.bank_set],
        practice: [],
        trials: [],
        pos: [],
        ...(c.participant_code >= 0 && r[c.participant_code] ? { participant: r[c.participant_code] } : {}),
      };
      runs.set(id, run);
    }
    const t: TrialRecord = { i: r[c.item_id], r: response, rt: Number(r[c.rt_ms]), s: source === "button" ? "button" : "key" };
    run.trials.push(t);
    run.pos.push(Number(r[c.position]));
  }
  return [...runs.values()].map(({ pos, ...run }) => {
    const order = run.trials.map((t, k) => ({ t, p: pos[k] })).sort((a, b) => a.p - b.p);
    return { ...run, trials: order.map((o) => o.t) };
  });
}
