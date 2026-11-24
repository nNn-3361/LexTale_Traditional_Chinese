# Running the pilot without a server

This setup runs the pilot test with nothing for the team to maintain: the test
page is a static site on GitHub Pages, and results go to a Google Sheet owned
by the team. The FastAPI + MySQL system in `server/` is not used for now
(team decision, 2026-11-11, until hosting is discussed with the supervisor).
It stays in the repository and can be used later.

| Part | Where | Cost |
| --- | --- | --- |
| Test page (`web/pilot.html`) | GitHub Pages, built by `.github/workflows/pilot-pages.yml` | Free for public repositories |
| Results | A Google Sheet, written by an Apps Script web app (`web/apps-script/Code.gs`) | Free within Google's quotas |

## What participants see

1. Consent page (the placeholder text in `web/src/text.ts`; whether it needs
   ethics review approval is to be checked with the supervisor [TBD]) with an optional participant code field. A small link at
   the bottom leads researchers to the item analysis page (`analysis.html`);
   it holds no participant data, only what is stored in that browser.
2. Instructions, 4 practice items with feedback, then 90 test items in random
   order: 60 real and 30 pseudo-characters (2:1, team decision 2026-11-23).
   Each run draws a new random 60 + 30 from the pilot set
   (`stimuli/sets/pilot-v2/`), so all items in the bank get responses. The
   practice items come from bank items not drawn for that run, so no item is
   shown twice. The final fixed 90 items are chosen from the pilot data [TBD].
3. Their answers are sent to the sheet. If sending fails, they can retry or
   download a CSV file to give to the researcher.
4. A thank-you message and their averaged score. They do not see which items
   they got wrong.

Link parameters: `?g=GROUP` sets the group label (for example `native` or
`learner`) and `?p=CODE` fills in the participant code. Both accept only
letters, digits, `-` and `_`, so a name cannot be entered. Example:
`https://nnn-3361.github.io/LexTale_Traditional_Chinese/?g=learner&p=L001`
[Unverified, confidence 85%; the exact address is shown in the repository's
Pages settings after the first deployment].

## One-time setup

Done by a team member; the steps need the team's own accounts.

### 1. Google Sheet and Apps Script

1. With the team's or school's Google account, create a new Google Sheet, for
   example "LexTALE pilot results".
2. In the sheet: Extensions > Apps Script. Delete the sample code, paste the
   whole of `web/apps-script/Code.gs`, and save.
3. Deploy > New deployment > Select type: Web app.
   - Execute as: Me
   - Who has access: Anyone
4. Deploy, allow the permissions Google asks for, and copy the web app URL
   (it ends in `/exec`).
5. Optional check: open the URL in a browser. It should show
   `{"ok":true,"info":"LexTALE pilot results endpoint..."}`.

After a change to `Code.gs`, use Deploy > Manage deployments > Edit > New
version, so the URL stays the same.

### 2. GitHub Pages

1. Repository Settings > Pages > Build and deployment > Source: GitHub Actions.
2. Repository Settings > Secrets and variables > Actions > Variables > New
   repository variable: `PILOT_RESULTS_URL` = the web app URL from step 1.
   (It is a variable, not a secret: the URL is in the published page anyway.)
3. Actions > Pilot page > Run workflow. Later runs happen on every merge to
   `main` that changes `web/` or the pilot item set.

The workflow does nothing until `PILOT_RESULTS_URL` is set.

## The data

The sheet gets two tabs, created on the first result:

- `trials`: one row per test trial, with the same columns as the analysis page's
  raw CSV (`run_id`, `created_at`, `label`, `set`, `bank_set`, `position`,
  `item_id`, `lexicality`, `item_type`, `response`, `correct`, `rt_ms`,
  `source`, `participant_code`).
- `runs`: one row per finished test, with the scores the page computed
  (averaged score, real and pseudo percent correct, Ghent score (hits - 2 x false alarms), d', mean
  RT of correct answers), the consent text version and the browser's user agent.

### Summary tab (optional)

A tab that updates itself with each new run: per group (the `?g=` label; runs
without one are shown as "(未填)"), the number of runs, mean and SD of the
averaged score, mean and SD of the Ghent score, and mean d'. Runs with the
group `test` are left out. It counts runs, not people: a person who takes the
test twice is counted twice, so check `participant_code` before analysis.

To add it: in the sheet, add a tab (for example `summary`), click cell A1 and
paste this formula. It reads the `runs` tab only and does not change it.

```
=LET(
  id, runs!A2:A, lab, runs!D2:D, avg, runs!J2:J, gh, runs!M2:M, dp, runs!N2:N,
  grp, IF(lab = "", "(未填)", lab),
  keep, (id <> "") * (lab <> "test") = 1,
  g, IFERROR(SORT(UNIQUE(FILTER(grp, keep))), "(還沒有資料)"),
  VSTACK(
    {"組別 group", "作答次數 n", "平均分數 平均", "平均分數 標準差", "Ghent 平均", "Ghent 標準差", "d′ 平均"},
    HSTACK(
      g,
      MAP(g, LAMBDA(x, IFERROR(COUNT(FILTER(avg, keep, grp = x)), 0))),
      MAP(g, LAMBDA(x, IFERROR(ROUND(AVERAGE(FILTER(avg, keep, grp = x)), 2), "-"))),
      MAP(g, LAMBDA(x, IFERROR(ROUND(STDEV(FILTER(avg, keep, grp = x)), 2), "-"))),
      MAP(g, LAMBDA(x, IFERROR(ROUND(AVERAGE(FILTER(gh, keep, grp = x)), 2), "-"))),
      MAP(g, LAMBDA(x, IFERROR(ROUND(STDEV(FILTER(gh, keep, grp = x)), 2), "-"))),
      MAP(g, LAMBDA(x, IFERROR(ROUND(AVERAGE(FILTER(dp, keep, grp = x)), 3), "-")))
    )
  )
)
```

[Unverified, confidence 80%; written for Google Sheets' LET, MAP, LAMBDA,
VSTACK and HSTACK functions and not yet tried in the team's sheet.]

For item analysis: open the item analysis page (`analysis.html` on the same
site, for example
`https://nnn-3361.github.io/LexTale_Traditional_Chinese/analysis.html`). It
reads the `trials` tab through the web app (`?data=trials`) each time it opens,
so anyone with the link sees the latest data. The `participant_code` column is
not sent, but labels, item responses and RTs are public to anyone who finds the
web app URL (team decision 2026-11-24: acceptable for the pilot). This needs
the `Code.gs` from 2026-11-24 or later; with an older deployment the page says
the script must be redeployed. A CSV of the `trials` tab can still be imported
with "匯入原始作答 CSV"; imported data stays in that browser.

No names, emails or IP addresses are collected. Participant codes link to
people only through the researcher's own list, which must not go into this
repository (`AGENTS.md`, section 5). The raw sheet must not be committed either.

## Limits and risks

- The web app URL is public (it is in the page). Anyone who finds it can send
  made-up results. The script checks the format of every request and ignores a
  run it already has, but data must be screened before analysis (for example,
  runs with very short RTs, or without a participant code when codes were
  given out).
- The item list and answer key (`items.json`) are public, as `items.csv` already
  is in this repository. A participant who looks for them can find them.
- Scores are computed in the participant's browser. Analysis should recompute
  them from the `trials` tab.
- Google Apps Script has daily quotas; a pilot of a few hundred runs is far
  below them [Unverified, confidence 80%; check
  https://developers.google.com/apps-script/guides/services/quotas].
- The data are stored by Google. The consent form (and an ethics application,
  if one is needed) must say where the data are kept [TBD].
- Before collecting real data, the consent text must be final and
  `CONSENT_VERSION` in `web/src/text.ts` updated.
