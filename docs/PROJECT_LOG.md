# Project Log

One line per change: date, summary, pull request. Newest first.

- 2026-11-12: Pseudo-character maker: each source now has a crop box (cut on all four sides) and each part can be moved and scaled on the result; old items render unchanged, and the CSV adds crop and move columns. (#10)
- 2026-11-11: Rewrote the README for the team and supervisor: decisions so far, current status, the three versions of the test (beta, no-maintenance pilot, full system), item bank, scoring, open issues, and checked references. (#9)
- 2026-11-11: Decided to run the pilot without a server for now: added a participant pilot page published on GitHub Pages that sends results to a team Google Sheet (Apps Script); the FastAPI + MySQL system is kept but not used until hosting is discussed with the supervisor. (#8)
- 2026-11-11: Added a beta test page (`web/beta.html`) that runs the full test flow in the browser without the server, with scores, per-item results, item analysis over saved runs, and CSV export, for trying the pilot draft set before review is finished. (#7)
- 2026-11-11: Expanded the pilot draft set to 180 items (90 real, 45 legal-position pseudo-characters, 45 illegal-position non-characters), following LEXTALE_CH's pilot pool; the first 90 items are unchanged. Not yet reviewed. (#6)
- 2026-11-11: Added a 90-item pilot draft set (60 real characters from the MOE 2012-2015 frequency tables, 23 legal-position pseudo-characters, 7 illegal-position non-characters) as transparent PNGs in Source Han Serif TC; pseudo-character maker can now keep either half of a source. Not yet reviewed. (#5)
- 2026-11-10: Pseudo-character maker: stroke cutting removes leftover fragments; added an eraser whose edits are saved and listed in the CSV. (#4)
- 2026-11-09: Added the test system skeleton: MySQL schema, FastAPI backend, item bank import tool, jsPsych test page, Docker Compose. (#3)
- 2026-11-09: Added AI collaboration guidelines (`AGENTS.md`, `CLAUDE.md`), this project log, and a pull request template. (#2)
- 2026-11-09: Added the pseudo-character maker tool in `stimuli/tools/pseudo-character-maker/`. (#1)
- 2026-11-06: Rewrote the README in English and removed emoji. (direct commit to `main`, before the pull request rule)
- 2026-11-06: Added the project README. (direct commit to `main`, before the pull request rule)
