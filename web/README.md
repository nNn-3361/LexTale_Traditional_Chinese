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

## Beta page (no server)

`beta.html` runs the whole test in the browser, without the backend or a
database, so the team can try the flow and see how an item set performs before
the pilot. It is for internal trials only, not for collecting research data:
it has no consent step and does not use session codes.

```sh
cd web
npm install
npm run beta:dev     # http://localhost:5173/beta.html
npm run beta:build   # writes dist-beta/, a static site (open it from any web server)
```

`beta:prepare` (run by both commands) reads `stimuli/sets/pilot-draft-v1/items.csv`
and its images and writes them to `web/.beta-bank/` (generated, not committed).
To use another set: `node scripts/prepare-beta-bank.mjs path/to/set`.

Flow:

1. Choose the items: all 180, batch 1 (90), or a quick 20 (10 real, 10 pseudo).
   An optional group label (for example `native` or `learner`) is used to
   compare groups. It must not be a name or student ID.
2. Instructions, then 4 practice items (2 real, 2 pseudo) with feedback. The
   item set has no separate practice items yet [TBD], so practice items are
   taken from bank items outside the chosen set; with all 180 they come from
   the set and are left out of that run's test.
3. Test items in a new random order for each run, each after a 500 ms fixation
   cross. Same trial plugin, keys and RT measurement as the real test page.
4. Result: scores (below) and a per-item table (response, correct or not, RT),
   downloadable as CSV.
5. Item analysis (`beta.html#analysis`): over all runs saved in this browser,
   per item the number of answers, percent correct, percent "yes", mean RT of
   correct answers, and the point-biserial correlation between getting the item
   right and the run's averaged score. Filters by group, item type and batch.
   Exports a per-item CSV and a raw CSV (one row per trial). A raw CSV from
   another browser can be imported, so results from several testers can be
   pooled.

Runs are kept in the browser's `localStorage`. When the page runs as a
claude.ai Artifact with the `db` capability, runs are also saved to the
Artifact's shared store, so the item analysis pools everyone who used that
page. Elsewhere this part is not used.

Scores shown (computed in the browser for the beta only; the real system
scores on the server, and the final scoring method is [TBD] after the pilot):

| Score | Formula |
| --- | --- |
| Averaged score | (percent correct on real items + percent correct on pseudo items) / 2. LexTALE's score (Lemhoefer & Broersma, 2012, https://doi.org/10.3758/s13428-011-0146-0); same as the server's `lextale_avg`. Not affected by the real:pseudo ratio. |
| Ghent-style score | real correct - (real items / pseudo items) x pseudo items answered "yes". For tests with twice as many real as pseudo items this is "real correct - 2 x false alarms" [Unverified, confidence 70%; check Brysbaert (2013) and Chan & Chang (2018) for the exact definitions]. The pilot set is 1:1, so the factor is 1. |
| d' | z(hit rate) - z(false alarm rate), with the log-linear correction (add 0.5 to counts and 1 to totals) so rates of 0 or 1 still give a finite value. |

## Pilot page (no server)

`pilot.html` is the participant version of the beta page, for running the
pilot without a server of our own. It adds a consent page and an optional
participant code, does not show participants which items they got wrong, and
sends each finished run to the team's Google Sheet through
`apps-script/Code.gs`. It is published on GitHub Pages by
`.github/workflows/pilot-pages.yml`. Setup, data and limits:
[`docs/pilot-hosting.md`](../docs/pilot-hosting.md).

```sh
VITE_RESULTS_URL=https://script.google.com/macros/s/.../exec npm run pilot:build   # writes dist-pilot/
npm run pilot:dev    # http://localhost:5173/pilot.html (answers go nowhere unless VITE_RESULTS_URL is set)
```

The beta and pilot pages share the test itself (`src/beta/run-test.ts`). The
raw CSV now has a `participant_code` column; files without it still import.
