/**
 * Pilot page: the participant-facing version of the beta page, for collecting
 * pilot data without a server of our own.
 *
 *   consent (+ optional participant code) -> test (beta/run-test.ts)
 *   -> results sent to the team's Google Sheet -> thanks and score
 *
 * Participants never see which items they got wrong. Build-time settings
 * (see docs/pilot-hosting.md):
 *   VITE_RESULTS_URL  Apps Script web app URL that writes to the sheet
 *   VITE_PILOT_SET    all (default) or batch1
 * Link parameters: ?g=GROUP (for example native or learner) and ?p=CODE
 * (participant code from the researcher). Both accept only letters, digits,
 * "-" and "_", so a name cannot be entered by mistake.
 */
import { CONSENT_VERSION, text } from "../text";
import { rawCsv, runScore } from "./analysis";
import { loadBank, planRun, type Item, type SetChoice } from "./bank";
import { runTest } from "./run-test";
import { RESULTS_URL, sendRun } from "./sheets";
import * as store from "./store";
import "./beta.css";

const app = document.getElementById("app")!;
const stage = document.getElementById("stage")!;

const CODE_RE = /^[A-Za-z0-9_-]{1,20}$/;
const params = new URLSearchParams(location.search);
const clean = (v: string | null) => (v && CODE_RE.test(v) ? v : "");
const group = clean(params.get("g"));
const SET: SetChoice = import.meta.env.VITE_PILOT_SET === "batch1" ? "batch1" : "all";

function show(html: string) {
  stage.hidden = true;
  stage.innerHTML = "";
  app.hidden = false;
  app.innerHTML = `<main class="pilot stack">${html}</main>`;
  window.scrollTo(0, 0);
}

function askConsent(): Promise<string | null> {
  const fromUrl = clean(params.get("p"));
  return new Promise((resolve) => {
    show(`
      <h1>${text.title}</h1>
      ${RESULTS_URL ? "" : `<p class="draft">[Setup] VITE_RESULTS_URL is not set: answers will not be sent anywhere.</p>`}
      ${text.consent}
      <form id="consent-form" class="stack-s">
        <label class="field" for="pcode">
          <span>受試者編號（研究人員提供，沒有可留空）/ Participant code (from the researcher; leave empty if none)</span>
          <input id="pcode" maxlength="20" autocomplete="off" value="${fromUrl}" pattern="[A-Za-z0-9_\\-]{0,20}">
          <small class="muted">只能用英文字母、數字、- 和 _。請勿輸入姓名。 / Letters, digits, - and _ only. Do not enter your name.</small>
        </label>
        <div class="row">
          <button class="btn primary" type="submit">${text.agree}</button>
          <button class="btn" type="button" id="decline">${text.disagree}</button>
        </div>
      </form>`);
    const form = document.getElementById("consent-form") as HTMLFormElement;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const code = (document.getElementById("pcode") as HTMLInputElement).value.trim();
      if (code && !CODE_RE.test(code)) return;
      resolve(code);
    });
    document.getElementById("decline")!.addEventListener("click", () => resolve(null));
  });
}

async function deliver(run: store.RunRecord, byId: Map<string, Item>) {
  show(text.saving);
  let result = await sendRun(run, byId);
  while (result === "failed") {
    show(`
      ${text.saveError}
      <div class="row center">
        <button class="btn primary" id="retry">${text.retry}</button>
        <button class="btn" id="dl">下載作答檔 / Download your answers</button>
      </div>
      <p class="muted">如果一直無法送出，請下載作答檔並交給研究人員。<br>If sending keeps failing, download your answers and give the file to the researcher.</p>`);
    document.getElementById("dl")!.addEventListener("click", () =>
      store.saveFile(`lextale-pilot-${run.id.slice(0, 8)}.csv`, rawCsv([run], byId)).catch(console.error),
    );
    await new Promise((r) => document.getElementById("retry")!.addEventListener("click", r, { once: true }));
    show(text.saving);
    result = await sendRun(run, byId);
  }
}

async function main() {
  let bank;
  try {
    bank = await loadBank();
  } catch (e) {
    console.error(e);
    show(text.loadError);
    return;
  }
  const byId = new Map(bank.items.map((i) => [i.id, i]));

  const participant = await askConsent();
  if (participant === null) {
    show(text.declined);
    return;
  }

  const plan = planRun(bank.items, SET, true);
  app.hidden = true;
  stage.hidden = false;
  const trials = await runTest(stage, plan);
  const run: store.RunRecord = {
    id: store.newRunId(),
    createdAt: new Date().toISOString(),
    label: group,
    set: SET,
    bankSet: bank.set,
    practice: plan.practice.map((i) => i.id),
    trials,
    participant: participant || undefined,
    consentVersion: CONSENT_VERSION,
  };
  // Backup copy in this browser, in case sending fails and the page is closed.
  await store.saveRun(run);
  await deliver(run, byId);
  show(text.thanks + text.score(runScore(run, byId).avgPct));
}

main().catch((e) => {
  console.error(e);
  show(text.loadError);
});
