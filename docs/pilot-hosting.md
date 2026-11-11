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

1. Consent page (the draft text in `web/src/text.ts`, [TBD]: needs ethics
   review approval) with an optional participant code field.
2. Instructions, 4 practice items with feedback, then the test items in a new
   random order (all 180 pilot items by default, 176 after practice).
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
3. Optional variable `PILOT_SET` = `batch1` to give only the first 90 items.
4. Actions > Pilot page > Run workflow. Later runs happen on every merge to
   `main` that changes `web/` or the pilot item set.

The workflow does nothing until `PILOT_RESULTS_URL` is set.

## The data

The sheet gets two tabs, created on the first result:

- `trials`: one row per test trial, with the same columns as the beta page's
  raw CSV (`run_id`, `created_at`, `label`, `set`, `bank_set`, `position`,
  `item_id`, `lexicality`, `item_type`, `response`, `correct`, `rt_ms`,
  `source`, `participant_code`).
- `runs`: one row per finished test, with the scores the page computed
  (averaged score, real and pseudo percent correct, Ghent-style score, d', mean
  RT of correct answers), the consent text version and the browser's user agent.

For item analysis: File > Download > CSV of the `trials` tab, then import it
with "匯入原始作答 CSV" on the beta page's item analysis view (`beta.html#analysis`,
or the team's claude.ai preview page).

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
- The data are stored by Google. The consent form and ethics application must
  say where the data are kept [TBD].
- Before collecting real data, the consent text must be final and
  `CONSENT_VERSION` in `web/src/text.ts` updated.
