/**
 * Sends a finished pilot run to the team's Google Sheet, through the Apps
 * Script web app in web/apps-script/Code.gs. Set its URL at build time with
 * VITE_RESULTS_URL (see docs/pilot-hosting.md).
 *
 * The body is sent as text/plain, so the browser makes a "simple" request
 * with no CORS preflight, which Apps Script cannot answer. If the response
 * cannot be read, the run is sent once more in no-cors mode; the script
 * ignores a run_id it already has, so a repeat never makes a duplicate.
 */
import type { Item } from "./bank";
import { isCorrect, runScore } from "./analysis";
import type { RunRecord } from "./store";

export const RESULTS_URL: string = import.meta.env.VITE_RESULTS_URL ?? "";

export function payload(run: RunRecord, items: Map<string, Item>) {
  const s = runScore(run, items);
  const r = (v: number | null, d: number) => (v === null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));
  return {
    v: 1,
    run: {
      run_id: run.id,
      created_at: run.createdAt,
      label: run.label,
      participant_code: run.participant ?? "",
      set: run.set,
      bank_set: run.bankSet,
      consent_version: run.consentVersion ?? "",
      user_agent: navigator.userAgent.slice(0, 300),
      n_trials: run.trials.length,
      avg_pct: r(s.avgPct, 2),
      real_pct: r(s.realPct, 2),
      pseudo_pct: r(s.pseudoPct, 2),
      ghent: r(s.ghent, 2),
      d_prime: r(s.dPrime, 3),
      mean_rt_correct_ms: r(s.meanRtCorrect, 0),
    },
    trials: run.trials.map((t, k) => {
      const item = items.get(t.i);
      return {
        position: k + 1,
        item_id: t.i,
        lexicality: item?.lexicality ?? "",
        item_type: item?.type ?? "",
        response: t.r,
        correct: item ? (isCorrect(item, t.r) ? 1 : 0) : "",
        rt_ms: t.rt,
        source: t.s,
      };
    }),
  };
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/** "saved": the script confirmed it; "sent": sent, but the reply could not be read; "failed": not sent. */
export type SendResult = "saved" | "sent" | "failed";

export async function sendRun(run: RunRecord, items: Map<string, Item>): Promise<SendResult> {
  if (!RESULTS_URL) return "failed";
  const body = JSON.stringify(payload(run, items));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(RESULTS_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
      if (!res.ok) {
        console.error(`Results script answered ${res.status}`);
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (json.ok) return "saved";
      console.error("Results script refused the run:", json.error);
      return "failed";
    } catch (e) {
      console.error(e);
      // A network error, or a reply the browser would not let the page read.
      try {
        await fetch(RESULTS_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
        return "sent";
      } catch (e2) {
        console.error(e2);
        await sleep(1000 * 2 ** attempt);
      }
    }
  }
  return "failed";
}
