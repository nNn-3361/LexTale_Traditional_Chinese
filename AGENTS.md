# AI Collaboration Guidelines

These rules apply to anyone who uses an AI assistant (Claude, ChatGPT, Copilot, Codex or others) to change this repository, and to the AI assistant itself. Team members: read this before you ask an AI to work on the project, and give it this file if it does not read it automatically.

The goal is to avoid mistakes that cannot be undone and to keep the quality of AI-made changes consistent.

## 1. Changes go through pull requests

- Never commit or push directly to `main`. Create a branch, push it, and open a pull request.
- At least one team member other than the author reviews and approves a pull request before it is merged. An AI never approves or merges a pull request.
- Keep each pull request to one topic. Split unrelated changes into separate pull requests.
- The pull request description says what changed, why, and how it was checked. If something was not checked, say so.
- Never force-push, rewrite history, or delete branches that are not your own.

## 2. Keep the project log up to date

- Every pull request adds one entry to [`docs/PROJECT_LOG.md`](docs/PROJECT_LOG.md).
- An entry is one line: date (YYYY-MM-DD), a short summary, and the pull request number. Newest entries go first.
- Log what changed for the project, not every file touched. Decisions the team made (for example, a change to the test design) are logged too.

## 3. Accuracy of information

- Use only information you can check. Every fact taken from outside the repository (a paper, a dataset, a statistic, a character list) names its source: a DOI, URL, or full citation.
- Never invent references, DOIs, numbers, quotes, or character data. If a source cannot be found, leave the claim out or mark it as unverified.
- Mark anything not yet verified with the tag `[Unverified, confidence NN%]`, where NN is 0 to 100, and say what needs to be checked. Example: `LEXTALE_CH has 90 items [Unverified, confidence 60%; check the original paper]`.
- When a request is ambiguous, ask instead of guessing.

## 4. Writing style

- Do not use emoji anywhere: documents, code, comments, commit messages, or pull requests.
- Repository documents are written in English. Use plain, short sentences.
- Mark unfinished parts with `[TBD]`.

## 5. Research data and participants

- Never commit participant data that can identify a person (names, student IDs, emails, phone numbers, IP addresses), raw response files, or signed consent forms. Only de-identified data goes in `data/`, and only when the consent form allows it.
- Never commit passwords, API keys, tokens, or database credentials.
- Do not change raw data. Corrections and exclusions are made by scripts, so every step can be reproduced.
- Hypotheses and analysis plans that have been pre-registered are not changed silently. Any change is logged and explained.

## 6. Licenses and third-party material

- Code in this repository is MIT licensed; the item bank and stimulus images are CC BY 4.0.
- Before adding a font, corpus, word or character list, or any other third-party material, check that its license allows redistribution under these terms. Note the source and license in the pull request.
- If the license is unclear, do not add the material. Link to it instead and raise the question in the pull request.

## 7. Stimuli and generated files

- Stimulus images and other generated files are produced by scripts or tools in this repository. Do not edit generated output by hand; change the source and regenerate it.
- Every real or pseudo-character added to the item bank is checked by a person (see `stimuli/tools/pseudo-character-maker/README.md`).

## 8. Safety

- Do not delete files, folders, or data without saying exactly what will be removed and why in the pull request.
- Do not change repository settings, branch protection, or access permissions.
- Do not publish anything outside the repository (posts, emails, uploads) on the team's behalf without a team member's explicit request.
