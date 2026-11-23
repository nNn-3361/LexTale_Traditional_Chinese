# Test page

The page participants use, built with jsPsych 8 and TypeScript (Vite).

## Flow

1. Session code (from the link `/?s=CODE` or typed in)
2. Consent. In research mode, an optional participant code follows
3. All images are preloaded before any trial starts, so loading time does not
   affect reaction times
4. Instructions, then practice items with feedback
5. Test items in the order set by the server (random per run unless the form
   is set otherwise), each after a 500 ms fixation cross
6. Remaining responses are sent, then the score (formal mode) or a thank-you
   message (research mode) is shown

Participants answer with the F key (real character) and J key (not a real
character), or by tapping the buttons on phones and tablets. The reaction
time is measured from the first frame on which the image is shown. Each
response is sent to the server right away and retried if the connection
fails.

The page holds no items. It gets the trial list and image URLs from the server.

## Development

```sh
cd web
npm install
npm run dev      # http://localhost:5173, forwards /api and /media to port 8000
npm run build    # writes dist/
```

The backend must be running on port 8000 (see `server/README.md`).

Participant-facing text is in `src/text.ts`. The consent text there is a
placeholder [TBD]; the final text needs ethics review approval. When it
changes, update `CONSENT_VERSION` in `src/text.ts` and the server's
`CONSENT_VERSION` setting together.

## Pilot page and item analysis page (no server)

Both pages are static and are built together:

```sh
cd web
npm install
npm run pilot:dev     # http://localhost:5173/pilot.html and /analysis.html
npm run pilot:build   # writes dist-pilot/ (index.html = pilot page, analysis.html)
```

`beta:prepare` (run by both commands; the name is kept from the removed beta
page) reads `stimuli/sets/pilot-v2/items.csv` and its images and writes them to
`web/.beta-bank/` (generated, not committed). To use another set:
`node scripts/prepare-beta-bank.mjs path/to/set`.

The beta page (`beta.html`, an internal trial version of the test with
results and item analysis) was removed on 2026-11-23 (team decision). Its test
flow lives on as the pilot page, and its item analysis view as `analysis.html`.

Look: both pages use an off-white paper style (`src/beta/ink.css`): a fibre
texture, a roof eave and a pavilion in pale yellow ink wash
(`src/beta/art/*.svg`, drawn for this project), light grey headings in Chiron Sung HK (a Song
typeface with brush-like stroke ends), text in Noto Serif TC (both SIL Open Font License 1.1,
loaded from Google Fonts, so the page falls back to system fonts offline), and a red seal.
Small animations: pages fade in, the seal is stamped in, tabs get an ink underline, and buttons
show an ink-spread ripple when pressed (`src/beta/ink-fx.ts`). The test screen has none of
these: it stays plain, and the character images stay on a white card. Animations are off when
the system asks for reduced motion.

Test flow (pilot page):

1. Consent and an optional participant code.
2. Instructions, then 4 practice items (2 real, 2 pseudo) with feedback. The
   item set has no separate practice items yet [TBD], so practice items are
   taken from bank items not drawn for that run.
3. 90 test items (60 real, 30 pseudo, drawn at random from the set for each
   run) in random order, each after a 500 ms fixation cross. Same trial plugin,
   keys and RT measurement as the real test page.
4. The run is sent to the results sheet; the participant sees the averaged score.

Item analysis (`analysis.html`): import the raw CSV (one row per trial, the
`trials` tab of the results sheet). Per item: the number of answers, percent
correct, percent "yes", mean RT of correct answers, and the point-biserial
correlation between getting the item right and the run's averaged score.
Filters by group, item type and batch. Exports a per-item CSV and a raw CSV.
Imported runs, and runs taken in the same browser, are kept in that browser's
`localStorage` only.

Scores (computed in the browser; the real system scores on the server, and
the final scoring method is [TBD] after the pilot):

| Score | Formula |
| --- | --- |
| Averaged score | (percent correct on real items + percent correct on pseudo items) / 2. LexTALE's score (Lemhoefer & Broersma, 2012, https://doi.org/10.3758/s13428-011-0146-0); same as the server's `lextale_avg`. Not affected by the real:pseudo ratio. |
| Ghent score | real items answered "yes" - 2 x pseudo items answered "yes". The Corrected Accuracy of LEXTALE_CH (Chan & Chang, 2018, equation 2; checked 2026-11-11) and the Ghent score as given in LexCHI (Wen et al., 2023, https://doi.org/10.3758/s13428-023-02151-z; checked 2026-11-23). The factor 2 fits the 60/30 test form. Shown with its normalised form, 100 x score / real items (Wen et al., 2023). Same as the server's `ghent` and `ghent_norm`. |
| d' | z(hit rate) - z(false alarm rate), with the log-linear correction (add 0.5 to counts and 1 to totals) so rates of 0 or 1 still give a finite value. |

## Pilot page (no server)

`pilot.html` runs the pilot without a server of our own. It has a consent
page and an optional participant code, does not show participants which items
they got wrong, and sends each finished run to the team's Google Sheet through
`apps-script/Code.gs`. It is published on GitHub Pages by
`.github/workflows/pilot-pages.yml`. Setup, data and limits:
[`docs/pilot-hosting.md`](../docs/pilot-hosting.md).

```sh
VITE_RESULTS_URL=https://script.google.com/macros/s/.../exec npm run pilot:build   # writes dist-pilot/
npm run pilot:dev    # http://localhost:5173/pilot.html (answers go nowhere unless VITE_RESULTS_URL is set)
```

The test itself is in `src/beta/run-test.ts`. The
raw CSV has a `participant_code` column; files without it still import.
