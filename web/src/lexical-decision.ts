/**
 * jsPsych plugin for one lexical decision trial.
 *
 * Shows one preloaded image and waits for "real character" or "not a real
 * character", given by key (F / J) or by tapping a button (for phones and
 * tablets). The reaction time is measured from the first animation frame on
 * which the image is on screen, with performance.now().
 */
import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

const info = <const>{
  name: "lexical-decision",
  version: "0.1.0",
  parameters: {
    stimulus: { type: ParameterType.IMAGE, default: undefined },
    yes_label: { type: ParameterType.HTML_STRING, default: "Yes" },
    no_label: { type: ParameterType.HTML_STRING, default: "No" },
    yes_key: { type: ParameterType.KEY, default: "f" },
    no_key: { type: ParameterType.KEY, default: "j" },
    /** Image width and height on screen, in CSS pixels. */
    image_size: { type: ParameterType.INT, default: 220 },
  },
  data: {
    response: { type: ParameterType.STRING },
    rt: { type: ParameterType.INT },
    source: { type: ParameterType.STRING },
    presented_at: { type: ParameterType.STRING },
  },
};

type Info = typeof info;

class LexicalDecisionPlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private jsPsych: JsPsych) {}

  trial(display: HTMLElement, trial: TrialType<Info>) {
    display.innerHTML = `
      <div class="ld">
        <img class="ld-img" src="${trial.stimulus}" alt=""
             width="${trial.image_size}" height="${trial.image_size}" draggable="false">
        <div class="ld-buttons">
          <button type="button" class="jspsych-btn ld-btn" data-r="yes">${trial.yes_label}</button>
          <button type="button" class="jspsych-btn ld-btn" data-r="no">${trial.no_label}</button>
        </div>
      </div>`;

    const yesKey = trial.yes_key ?? "f";
    const noKey = trial.no_key ?? "j";
    let start = 0;
    let presentedAt = "";
    let done = false;
    let listener: ReturnType<JsPsych["pluginAPI"]["getKeyboardResponse"]> | null = null;

    const finish = (response: "yes" | "no", source: "key" | "button") => {
      if (done || start === 0) return;
      done = true;
      const rt = Math.round(performance.now() - start);
      if (listener) this.jsPsych.pluginAPI.cancelKeyboardResponse(listener);
      display.innerHTML = "";
      this.jsPsych.finishTrial({ response, rt, source, presented_at: presentedAt });
    };

    display.querySelectorAll<HTMLButtonElement>(".ld-btn").forEach((b) => {
      // pointerdown is used instead of click so touch and mouse timing match keys.
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        finish(b.dataset.r as "yes" | "no", "button");
      });
    });

    // The image is preloaded, so it is drawn on the next frame.
    requestAnimationFrame(() => {
      start = performance.now();
      presentedAt = new Date().toISOString();
      listener = this.jsPsych.pluginAPI.getKeyboardResponse({
        callback_function: (info: { key: string }) =>
          finish(this.jsPsych.pluginAPI.compareKeys(info.key, yesKey) ? "yes" : "no", "key"),
        valid_responses: [yesKey, noKey],
        rt_method: "performance",
        persist: false,
        allow_held_key: false,
      });
    });
  }
}

export default LexicalDecisionPlugin;
