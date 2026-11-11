/**
 * The test itself, shared by the beta page and the pilot page: preload,
 * instructions, practice with feedback, then the test items in the planned
 * order, each after a 500 ms fixation cross. The trial uses the same jsPsych
 * plugin as the real test page (../lexical-decision.ts), so keys, buttons and
 * RT measurement match.
 */
import { initJsPsych } from "jspsych";
import "jspsych/css/jspsych.css";
import HtmlButtonResponsePlugin from "@jspsych/plugin-html-button-response";
import HtmlKeyboardResponsePlugin from "@jspsych/plugin-html-keyboard-response";
import InstructionsPlugin from "@jspsych/plugin-instructions";
import PreloadPlugin from "@jspsych/plugin-preload";

import LexicalDecisionPlugin from "../lexical-decision";
import { text } from "../text";
import { isCorrect } from "./analysis";
import type { Item, Plan } from "./bank";
import type { TrialRecord } from "./store";

export function runTest(stage: HTMLElement, plan: Plan): Promise<TrialRecord[]> {
  const out: TrialRecord[] = [];
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
