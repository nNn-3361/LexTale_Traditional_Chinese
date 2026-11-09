# Server

Backend for the test system: a FastAPI app with a MySQL database. It stores the
item bank, gives the test page its list of trials, saves every response, and
computes scores.

No items are written in the code. The item bank is imported from an item list
(`items.csv`) and its images, so the bank can change without code changes.

## Requirements

- Python 3.12 or later
- MySQL 8.0 or later, with character set `utf8mb4`

## Database

Migrations are managed with Alembic (`alembic/versions/`). Columns that hold
Chinese characters use the collation `utf8mb4_bin`, so different characters
are never treated as equal. Times are `DATETIME(3)` in UTC.

| Table | Contents |
| --- | --- |
| `items` | One stimulus: item code, `real` or `pseudo`, the character (real items only), image path and hash, other columns of the item list as JSON |
| `item_bank_versions`, `bank_version_items` | Item bank versions (`v0`, `v1`, ...) and the items in each |
| `test_forms`, `form_items` | A set of items given together (a pilot sub-form or the final test), its mode (`research` or `formal`), and which items are practice items |
| `test_sessions` | A sitting with a code that participants enter |
| `participants` | Anonymous participant ID only |
| `participant_identities` | Name, student ID, email, and the code that links to proficiency test scores. Kept apart from responses; never included in analysis exports |
| `test_runs` | One participant taking one form: item bank version, consent version and time, start and finish times |
| `trials` | Each planned presentation in a run, in the order shown, with the response, correctness, reaction time (ms), and whether a key or a button was used |
| `scores` | Scores per run, with method name and formula version, so scores can be recomputed when a formula changes |

An item code always refers to the same stimulus. If an image or character
changes, the item needs a new code; the import refuses otherwise, so old
responses stay valid.

## Running locally

```sh
cd server
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt

export DATABASE_URL="mysql+pymysql://USER:PASSWORD@127.0.0.1:3306/lextale?charset=utf8mb4"
export MEDIA_DIR="$PWD/media"          # where imported images are stored
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Then start the test page in development mode (see `web/README.md`), or build it
and set `WEB_DIST` to `web/dist` so the server serves it at `/`.

The whole system can also be started with Docker Compose from the repository
root: copy `.env.example` to `.env`, set the passwords, and run
`docker compose up --build`. The test page is then at http://localhost:8000.

## Command line tools

Run from `server/` with `DATABASE_URL` and `MEDIA_DIR` set (inside Docker
Compose: `docker compose exec app python -m app.cli ...`).

```sh
# Import an item list and its images as a new item bank version.
# items.csv uses the format exported by stimuli/tools/pseudo-character-maker.
python -m app.cli import-bank --csv path/to/items.csv --version v0

# Make a form. Practice items are shown first with feedback and not scored.
# Without --items, every other item in the version is a test item.
python -m app.cli create-form --name pilot-A --version v0 --mode research --practice R001,P001
python -m app.cli create-form --name pilot-B --version v0 --mode research --items pilot-B.txt

# Open a session; prints the code participants enter (or use /?s=CODE).
python -m app.cli create-session --form pilot-A --label "Class 1"
python -m app.cli close-session --code ABC234

# Recompute all scores after a scoring formula changes.
python -m app.cli rescore
```

Required columns of `items.csv`: `item_id`, `lexicality` (`real` or `pseudo`),
`char` (empty for pseudo-characters), `image` (file name, looked up next to the
CSV unless `--images` is given). Other columns are stored as item attributes.

### Placeholder items for development

`scripts/make_demo_bank.py OUT_DIR` writes 10 placeholder images (labelled
"DEMO real 01" and so on) and an `items.csv`. They are for testing the system
only and must never be shown to participants. Generated output is not
committed.

## API

| Method and path | Use |
| --- | --- |
| `GET /api/sessions/{code}` | Session mode and item counts |
| `POST /api/runs` | Start a run after consent. Returns the trial list; the correct answer is included for practice trials only |
| `POST /api/runs/{run_id}/responses` | Save one response. Sent after every trial; a repeated identical send is accepted |
| `POST /api/runs/{run_id}/finish` | Mark the run finished and compute scores. Scores are returned in formal mode only |

Interactive documentation is at `/docs` while the server is running.

## Scoring

Only the averaged LexTALE score is implemented so far: the mean of percent
correct on real items and percent correct on pseudo-items (Lemhoefer &
Broersma, 2012, https://doi.org/10.3758/s13428-011-0146-0). Unanswered test
items count as incorrect. The method for the final test is [TBD] and will be
chosen from the pilot data (research proposal, section 5.6).

## Tests

```sh
cd server
python -m pytest
```

Tests use in-memory SQLite by default. Before merging changes to the models,
also run them against MySQL by setting `TEST_DATABASE_URL` to an empty test
database (all its tables are dropped).

## Security notes

Checked on 2026-11-09 (see the pull request for details). Before collecting real data:

- Put the app behind a reverse proxy with HTTPS (for example Caddy or nginx). Do not expose port 8000 directly to the internet. Add rate limiting there for `/api/sessions` and `/api/runs`, since these need no login.
- Set strong values in `.env`. Never commit `.env`.
- Close sessions (`close-session`) when a class or study round is done; anyone with an open code can start runs.
- `participant_identities` is only separated by table. Limit who has database access, back up the database, and keep backups as protected as the database. Encryption at rest is [TBD].
- `test_runs.user_agent` (browser and device type) is kept for checking technical problems. Leave it out of analysis exports.
- The server does not write access logs, so participants' IP addresses are not stored. If the reverse proxy logs IP addresses, say so in the consent text or turn that logging off.
- The interactive API documentation at `/docs` is public. It shows no data.

## Not done yet

[TBD] Teacher dashboard, data export for analysis, final consent text,
participant background questions, and counterbalancing of the response keys.
