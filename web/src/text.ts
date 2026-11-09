/**
 * Text shown to participants. Traditional Chinese with English below it,
 * because many participants are learners of Chinese.
 *
 * [TBD] The consent text is a placeholder. The final text must be approved by
 * the ethics review (IRB) before any data is collected. When the consent text
 * changes, change CONSENT_VERSION here and the CONSENT_VERSION setting of the
 * server together, so every run records which text the participant agreed to.
 */

export const CONSENT_VERSION = "draft-0";

const both = (zh: string, en: string) => `<p>${zh}</p><p class="en">${en}</p>`;

export const text = {
  title: "繁體中文字彙測驗 / Traditional Chinese Character Test",
  enterCode: both("請輸入施測代碼", "Enter the session code"),
  start: "開始 / Start",
  badCode: both("找不到這個施測代碼，或施測已結束。", "Session code not found, or the session is closed."),
  loadError: both("無法連線到伺服器，請稍後再試。", "Cannot reach the server. Please try again later."),

  consent: `
    <div class="box">
      <h2>研究同意書 / Consent</h2>
      <p class="draft">[TBD] 草稿：正式內容須經研究倫理審查核准。<br>
      Draft: the final text must be approved by the ethics review.</p>
      ${both(
        "本測驗約需數分鐘。我們會記錄你的作答與反應時間，資料只用於研究，並以匿名方式分析。你可以隨時關閉頁面停止作答。",
        "This test takes a few minutes. We record your answers and response times. The data is used for research only and is analysed anonymously. You can stop at any time by closing the page.",
      )}
    </div>`,
  agree: "我同意 / I agree",
  disagree: "我不同意 / I do not agree",
  declined: both("你沒有同意參加，因此不會記錄任何資料。謝謝。", "You did not agree to take part, so no data was recorded. Thank you."),

  participantCode: "受試者編號（研究人員提供，沒有可留空）/ Participant code (from the researcher; leave empty if none)",
  next: "下一步 / Next",

  preloading: "載入中… / Loading…",
  preloadError: both("圖片載入失敗，請重新整理頁面。", "Some images failed to load. Please reload the page."),

  instructions: [
    `<div class="box"><h2>說明 / Instructions</h2>
      ${both(
        "畫面上會出現一個字。請判斷它是不是真的中文字。",
        "You will see one character at a time. Decide whether it is a real Chinese character.",
      )}
      ${both(
        "是真字：按 <kbd>F</kbd> 或點左邊的按鈕。不是真字：按 <kbd>J</kbd> 或點右邊的按鈕。",
        "Real character: press <kbd>F</kbd> or tap the left button. Not a real character: press <kbd>J</kbd> or tap the right button.",
      )}
      ${both("請盡量又快又準確。不確定的時候，請選「不是真字」。", "Answer as quickly and accurately as you can. If you are not sure, choose “not a real character”.")}
    </div>`,
  ],
  practiceStart: both("先做幾題練習。按任意鍵或點下方按鈕開始。", "First, a few practice items."),
  testStart: both("練習結束。接下來是正式測驗，不會再告訴你答案。", "Practice is over. The real test starts now, without feedback."),
  testStartNoPractice: both("準備好就開始測驗。", "Start the test when you are ready."),
  go: "開始 / Begin",
  yes: "是真字<br><small>Real (F)</small>",
  no: "不是真字<br><small>Not real (J)</small>",
  correct: "正確 / Correct",
  wrong: "錯誤 / Wrong",

  saving: "儲存中… / Saving…",
  saveError: both("部分作答尚未送出，請檢查網路後再試。", "Some answers were not sent. Check your connection and try again."),
  retry: "重試 / Retry",
  thanks: both("測驗結束，謝謝你的參與！", "The test is finished. Thank you for taking part!"),
  score: (v: number) =>
    both(`你的分數：<strong>${v.toFixed(1)}</strong>（滿分 100）`, `Your score: <strong>${v.toFixed(1)}</strong> out of 100`) +
    `<p class="draft">[TBD] 分數解釋將在效度研究完成後提供。<br>Score interpretation will be added after the validation study.</p>`,
};
