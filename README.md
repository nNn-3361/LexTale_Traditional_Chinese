# LexTALE Traditional Chinese

A short, character-based lexical decision test for Traditional Chinese, developed by a research team at National Taipei University of Technology (Taipei Tech). Test takers see one character at a time and decide whether it is a real character or not. The goal is a test of a few minutes that gives Chinese language teachers and researchers a quick estimate of a person's Chinese proficiency.

> **Status (2026-11-11): development, before the pilot.** A 180-item draft pool exists but has not been reviewed by a person yet. No participant data has been collected. The final test, its scoring, and its validity are not settled.

---

## Contents

- [About](#about)
- [Decisions so far](#decisions-so-far)
- [Current status](#current-status)
- [Three versions of the test](#three-versions-of-the-test)
- [Item bank](#item-bank)
- [Scoring](#scoring)
- [Open issues](#open-issues)
- [Repository structure](#repository-structure)
- [How we work](#how-we-work)
- [Research team](#research-team)
- [References](#references)
- [License](#license)

## About

LexTALE (Lemhöfer & Broersma, 2012) is a quick English proficiency test: participants decide for 60 letter strings whether each is a real English word, and the score correlates well with longer proficiency tests. Versions for other languages followed.

For Chinese, LEXTALE_CH (Chan & Chang, 2018) uses single characters: real characters and pseudo-characters. It is built on simplified characters. There is no version built for Traditional Chinese and for Taiwan and other Traditional Chinese-using contexts. This project develops one, following the design of LEXTALE_CH where that makes sense and adapting it where Traditional Chinese needs something different (frequency source, character forms).

## Decisions so far

Made by the team between 2026-11-06 and 2026-11-11:

| Topic | Decision |
| --- | --- |
| Unit | Single characters only: real characters vs. pseudo-characters (no words). |
| Who it is for | Learners of Chinese; researchers who need to check participants' Chinese level; Chinese teachers. |
| Native speakers | Tested as the difficulty baseline: real characters most native speakers do not know, and pseudo-characters they take for real, are dropped. |
| Validity | The team collects participants' Chinese proficiency test scores (for example TOCFL) and checks for a positive correlation with the test score. |
| Stimuli | Every item (real or pseudo) is shown as an image rendered in the same font (Source Han Serif TC), so rendering cannot give away the answer. |
| System | Built by the team (not Pavlovia, JATOS or similar). |
| Database (full system) | MySQL 8.0 or later, `utf8mb4`, `utf8mb4_bin` for character columns. |
| Hosting for the pilot | No server for now. The pilot runs on GitHub Pages and saves results to a Google Sheet. Long-term hosting is to be discussed with the supervisor. |
| Licenses | Code: MIT. Item bank and stimulus images: CC BY 4.0. |

## Current status

| Area | State |
| --- | --- |
| Pseudo-character maker tool | Done (`stimuli/tools/pseudo-character-maker/`). |
| Pilot item pool | 180-item draft done; manual review by the team not started. |
| Beta page for the team | Done and online as a private preview (see below). |
| Pilot page (no server) | Code merged. Not live yet: the Google Sheet and the `PILOT_RESULTS_URL` repository variable still need to be set up (the first workflow run on 2026-11-11 was skipped for this reason). |
| Full system (FastAPI + MySQL) | Skeleton done. Not deployed; no server. |
| Consent form and ethics review (IRB) | Placeholder text only [TBD]. |
| Data collection | Not started. |

## Three versions of the test

The same test exists in three forms, for three purposes. They share the test logic (trial display, keys, reaction-time measurement) but differ in where they run and where results go.

| | Beta page | Pilot page (no maintenance) | Full system |
| --- | --- | --- | --- |
| Purpose | The team tries the items and the flow, and looks at item statistics before the review is done | Collecting pilot data from participants | Pilot and validation studies, and later public use with instant scores |
| Code | `web/beta.html` (PR #7) | `web/pilot.html`, `web/apps-script/Code.gs` (PR #8) | `server/`, `web/index.html` (PR #3) |
| Runs on | A claude.ai Artifact preview, or any static web server | GitHub Pages (free for public repositories) | A server the team runs (Docker Compose) |
| Results go to | The browser (`localStorage`); in the Artifact preview, a shared store so the team's runs are pooled | A Google Sheet owned by the team, through an Apps Script web app | MySQL database |
| Needs maintenance | No | No server; a team member does a one-time setup | Yes: a server, backups, updates |
| Consent page | No (internal use only, not for research data) | Yes (draft text, needs ethics approval) | Yes (draft text, needs ethics approval) |
| Status | Usable now | Merged, waiting for one-time setup | Skeleton; on hold until hosting is discussed with the supervisor |
| Docs | [`web/README.md`](web/README.md) | [`docs/pilot-hosting.md`](docs/pilot-hosting.md) | [`server/README.md`](server/README.md) |

Beta preview for the team: https://claude.ai/artifact/Yc35CukmP9ognVh69asYXF (a private claude.ai page; ask the project owner for access).

All three use the F key for "real character" and the J key for "not a real character", or buttons on phones and tablets. Items appear in a new random order in each run, each after a 500 ms fixation cross.

## Item bank

### Pilot draft pool (`stimuli/sets/pilot-draft-v1/`)

180 items, following the pilot pool of LEXTALE_CH:

| Type | Items | Description |
| --- | --- | --- |
| Real characters | 90 | From the Ministry of Education word and character frequency survey (2012-2015, pooled, about 7.5 million characters), in six frequency bands weighted toward low frequency. Left-right and top-bottom structures only, standard Taiwan forms, 6 to 20 strokes. |
| Legal-position pseudo-characters | 45 | Two real components, each in a position it takes in real characters, combined into a character that does not exist (for example 言 + 胡 side by side). |
| Illegal-position non-characters | 45 | One component moved to a position it does not take in real characters (for example 氵 on the right). |

LEXTALE_CH took its pseudo-characters from Peng, Li and Yang (1997). Ours were made by the team with the pseudo-character maker, by joining half of one real Traditional Chinese character with half of another, following the same two types (legal and illegal component positions).

Every item is marked `review_status = pending`. Before the pilot, team members must check each pseudo-character against the MOE Dictionary of Chinese Character Variants, have native speakers confirm none is a real character, and check the images for leftover stroke pieces. The checklist, the full selection procedure, and how to regenerate the images are in [`stimuli/sets/pilot-draft-v1/README.md`](stimuli/sets/pilot-draft-v1/README.md).

### Final test (planned)

About 90 items: 60 real characters and 30 pseudo-characters, the same size and ratio as LEXTALE_CH. Items will be chosen from the pilot data with classical item analysis (percent correct, point-biserial correlation) and item response theory (IRT), keeping items with good discrimination and a wide range of difficulty [TBD: the final number and ratio depend on the pilot results].

## Scoring

The beta and pilot pages currently show three scores. The final scoring method will be chosen after the pilot [TBD].

| Score | Formula | Source |
| --- | --- | --- |
| Averaged score | (percent correct on real items + percent correct on pseudo items) / 2 | LexTALE (Lemhöfer & Broersma, 2012) |
| Corrected accuracy ("x2" score) | real items answered "real" minus 2 x pseudo items answered "real" | LEXTALE_CH (Chan & Chang, 2018), whose final test has 60 real and 30 pseudo items. The pages use (real items / pseudo items) as the factor, so on the 1:1 pilot pool it is 1. |
| d' | z(hit rate) - z(false alarm rate), with a log-linear correction | Signal detection theory |

## Open issues

Items the team, and in some cases the supervisor, need to decide or check:

1. **License of the MOE frequency data.** The frequency tables are not openly licensed (copyright: National Academy for Educational Research). The repository keeps only the counts of the 90 selected characters. Whether this excerpt may be published under CC BY needs to be confirmed.
2. **Consent form and ethics review.** The consent text in `web/src/text.ts` is a placeholder. The final text, including where the data are stored (Google for the pilot), needs ethics review approval before any real data are collected.
3. **Hosting.** Whether the school or the lab can host the full system, and who maintains it. To be discussed with the supervisor. Until then the pilot uses the no-maintenance setup.
4. **Manual review of the 180 items.** Not started. See the checklist in the item set's README.
5. **cjkvi-ids license.** Structure strings (IDS) from cjkvi-ids are stored for the 180 items. Its license is GPL-2.0 [Unverified, confidence 60%; check the cjkvi-ids repository]; whether storing these strings is fine needs to be confirmed.
6. **Participant recruitment.** Channels and target numbers for native speakers and learners [TBD].
7. **Practice items.** The pool has no dedicated practice items yet; practice currently uses pool items.
8. **Matching stroke counts.** Whether real and pseudo items should be matched on mean stroke count [TBD].

## Repository structure

```
AGENTS.md, CLAUDE.md        Rules for anyone (and any AI assistant) changing this repository
docs/PROJECT_LOG.md         One line per change, newest first
docs/pilot-hosting.md       Setup and limits of the no-maintenance pilot
stimuli/tools/pseudo-character-maker/   Browser tool that builds pseudo-character images
stimuli/sets/pilot-draft-v1/            The 180-item draft pool, its images, and the scripts that made it
web/                        Test pages: beta.html, pilot.html, index.html (full system); apps-script/
server/                     FastAPI + MySQL backend for the full system (not deployed)
Dockerfile, docker-compose.yml          Runs the full system
.github/workflows/pilot-pages.yml       Publishes the pilot page to GitHub Pages
```

## How we work

- Every change goes through a pull request reviewed by another team member. Nothing is pushed directly to `main`.
- Every pull request adds one line to [`docs/PROJECT_LOG.md`](docs/PROJECT_LOG.md), which is the quickest way to see what has happened.
- Facts from outside the repository name their source. Anything not yet checked is marked `[Unverified, confidence NN%]`.
- No participant data that can identify a person, and no credentials, are ever committed.
- Full rules: [`AGENTS.md`](AGENTS.md).

## Research team

Research team at National Taipei University of Technology, Taiwan.

[TBD] Team members, supervisor, department, and contact information.

## References

Checked on 2026-11-11 against the sources linked below, unless marked otherwise.

- Lemhöfer, K., & Broersma, M. (2012). Introducing LexTALE: A quick and valid Lexical Test for Advanced Learners of English. *Behavior Research Methods, 44*(2), 325-343. https://doi.org/10.3758/s13428-011-0146-0 (open access: https://pmc.ncbi.nlm.nih.gov/articles/PMC3356522/)
- Chan, I. L., & Chang, C. B. (2018). LEXTALE_CH: A quick, character-based proficiency test for Mandarin Chinese. In A. B. Bertolini & M. J. Kaplan (Eds.), *Proceedings of the 42nd annual Boston University Conference on Language Development* (pp. 114-130). Cascadilla Press. PDF: https://thepamlab.github.io/files/ChanChang2018_BUCLD42.pdf
  - Final test: 60 real characters and 30 pseudo-characters. Score: Corrected Accuracy = hits - 2 x false alarms (equation 2 in the paper).
  - Paper-based version with instructions and answer key, linked from the paper's Appendix B: https://osf.io/r3vs9/ (the OSF page itself could not be opened from our tools; its title and license are [Unverified, confidence 85% that it is the file the paper describes]).
- Peng, D.-L., Li, Y.-P., & Yang, H. (1997). Orthographic processing in the identification of Chinese characters. In H.-C. Chen (Ed.), *Cognitive processing of Chinese and related Asian languages* (pp. 85-108). The Chinese University Press. (Source of LEXTALE_CH's pseudo-characters. Checked against the reference list of Chan & Chang, 2018; the book itself was not consulted.)
- Da, J. (2004). Modern Chinese character frequency list. (Frequency source of LEXTALE_CH; simplified Chinese, about 193 million characters. Not used here.)
- 國家教育研究院 [National Academy for Educational Research] (2018).《一○○至一○四年常用語詞調查報告書》[Report on the survey of common words, 2011-2015]. ISBN 9789860583854. Frequency tables published by the Ministry of Education: https://language.moe.gov.tw/result.aspx?classify_sn=44&subclassify_sn=454. The 2012-2015 (民國101-104年) tables are the frequency source for our real characters. Not openly licensed; see Open issues.
- Adobe. Source Han Serif (思源宋體), version 2.003. SIL Open Font License 1.1. https://github.com/adobe-fonts/source-han-serif. Used to render all stimulus images; the font file is not stored in this repository.
- cjkvi-ids (Ideographic Description Sequences): https://github.com/cjkvi/cjkvi-ids. Used to look up character structures.

## License

- Code: MIT.
- Item bank and stimulus images: CC BY 4.0.

[TBD] The license files (`LICENSE`) have not been added to the repository yet.
