/**
 * Test flow:
 *   session code -> consent -> (research mode: participant code) -> start run
 *   -> preload all images -> instructions -> practice with feedback
 *   -> test items (order set by the server) -> send remaining answers -> score or thanks
 *
 * No items are written in this file. The list of trials and their images comes
 * from the server, which reads them from the item bank in the database.
 */
import { initJsPsych } from "jspsych";
import "jspsych/css/jspsych.css";
import HtmlButtonResponsePlugin from "@jspsych/plugin-html-button-response";
import HtmlKeyboardResponsePlugin from "@jspsych/plugin-html-keyboard-response";
import InstructionsPlugin from "@jspsych/plugin-instructions";
import PreloadPlugin from "@jspsych/plugin-preload";
import SurveyTextPlugin from "@jspsych/plugin-survey-text";

import * as api from "./api";
import LexicalDecisionPlugin from "./lexical-decision";
import { CONSENT_VERSION, text } from "./text";
import "./style.css";

const root = document.getElementById("app")!;

function show(html: string) {
  root.innerHTML = `<div class="box">${html}</div>`;
}

/** Step 1: get the session code from ?s=CODE or ask for it. */
function askCode(message = ""): Promise<string> {
  const fromUrl = new URLSearchParams(location.search).get("s");
  if (fromUrl && !message) return Promise.resolve(fromUrl);
  return new Promise((resolve) => {
    root.innerHTML = `
      <form class="box" id="code-form">
        <h1>${text.title}</h1>
        ${message}
        ${text.enterCode}
        <input id="code" autocomplete="off" autocapitalize="characters" maxlength="16" required>
        <button class="jspsych-btn" type="submit">${text.start}</button>
      </form>`;
    const form = document.getElementById("code-form") as HTMLFormElement;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      resolve((document.getElementById("code") as HTMLInputElement).value.trim());
    });
  });
}

/** Step 2: consent (and participant code in research mode), in a first jsPsych run. */
async function askConsent(session: api.SessionInfo) {
  let agreed = false;
  let externalCode = "";
  root.innerHTML = "";
  const jsPsych = initJsPsych({ display_element: root });
  const timeline: any[] = [
    {
      type: HtmlButtonResponsePlugin,
      stimulus: text.consent,
      choices: [text.agree, text.disagree],
      on_finish: (d: { response: number }) => (agreed = d.response === 0),
    },
  ];
  if (session.mode === "research") {
    timeline.push({
      conditional_function: () => agreed,
      timeline: [
        {
          type: SurveyTextPlugin,
          questions: [{ prompt: text.participantCode, name: "code" }],
          button_label: text.next,
          on_finish: (d: { response: { code: string } }) => (externalCode = d.response.code.trim()),
        },
      ],
    });
  }
  await jsPsych.run(timeline);
  return { agreed, externalCode };
}

/** Step 3: the test itself, in a second jsPsych run built from the server's trial list. */
async function runTest(run: api.Run) {
  const queue = new api.ResponseQueue(run.run_id);
  root.innerHTML = "";
  const jsPsych = initJsPsych({ display_element: root });

  const fixation = {
    type: HtmlKeyboardResponsePlugin,
    stimulus: '<div class="fixation">+</div>',
    choices: "NO_KEYS",
    trial_duration: 500,
  };

  const decision = (t: api.Trial) => ({
    type: LexicalDecisionPlugin,
    stimulus: t.image_url,
    yes_label: text.yes,
    no_label: text.no,
    data: { position: t.position, role: t.role },
    on_finish: (d: { response: "yes" | "no"; rt: number; source: "key" | "button"; presented_at: string }) => {
      queue.send({
        position: t.position,
        response: d.response,
        rt_ms: d.rt,
        source: d.source,
        presented_at: d.presented_at,
      });
    },
  });

  const practice = run.trials.filter((t) => t.role === "practice");
  const test = run.trials.filter((t) => t.role === "test");

  const timeline: any[] = [
    {
      type: PreloadPlugin,
      images: run.trials.map((t) => t.image_url),
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

  if (practice.length) {
    timeline.push({ type: HtmlButtonResponsePlugin, stimulus: text.practiceStart, choices: [text.go] });
    for (const t of practice) {
      timeline.push(fixation, decision(t), {
        type: HtmlKeyboardResponsePlugin,
        stimulus: () => {
          const last = jsPsych.data.get().last(1).values()[0];
          const ok = last.response === t.correct_response;
          return `<div class="feedback ${ok ? "ok" : "bad"}">${ok ? text.correct : text.wrong}</div>`;
        },
        choices: "NO_KEYS",
        trial_duration: 800,
      });
    }
  }
  timeline.push({
    type: HtmlButtonResponsePlugin,
    stimulus: practice.length ? text.testStart : text.testStartNoPractice,
    choices: [text.go],
  });
  for (const t of test) timeline.push(fixation, decision(t));

  await jsPsych.run(timeline);
  return queue;
}

/** Step 4: make sure every answer reached the server, then finish the run. */
async function finish(runId: string, queue: api.ResponseQueue, mode: api.Mode) {
  show(text.saving);
  while ((await queue.flush()) > 0) {
    show(`${text.saveError}<button class="jspsych-btn" id="retry">${text.retry}</button>`);
    await new Promise((r) => document.getElementById("retry")!.addEventListener("click", r, { once: true }));
    show(text.saving);
  }
  const result = await api.finishRun(runId);
  const score = result.scores.find((s) => s.method === "lextale_avg");
  show(text.thanks + (mode === "formal" && score ? text.score(score.value) : ""));
}

async function main() {
  let session: api.SessionInfo | null = null;
  let code = await askCode();
  while (!session) {
    try {
      session = await api.getSession(code);
    } catch (e) {
      code = await askCode(e instanceof api.ApiError && e.status === 404 ? text.badCode : text.loadError);
    }
  }
  if (session.consent_version !== CONSENT_VERSION) {
    // The page and the server disagree about the consent text; do not collect data.
    show(text.loadError);
    return;
  }

  const { agreed, externalCode } = await askConsent(session);
  if (!agreed) {
    show(text.declined);
    return;
  }

  const run = await api.startRun({
    session_code: session.code,
    consent: true,
    consent_version: CONSENT_VERSION,
    identity: externalCode ? { external_code: externalCode } : undefined,
  });
  const queue = await runTest(run);
  await finish(run.run_id, queue, run.mode);
}

main().catch((e) => {
  console.error(e);
  show(text.loadError);
});
