from app import models as m
from app.config import get_settings

CONSENT = get_settings().consent_version


def _start(client, code, **extra):
    r = client.post(
        "/api/runs", json={"session_code": code, "consent": True, "consent_version": CONSENT, **extra}
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_session_info(client, demo_session):
    r = client.get(f"/api/sessions/{demo_session.lower()}")
    assert r.status_code == 200
    body = r.json()
    assert body["n_practice"] == 2 and body["n_test"] == 8 and body["mode"] == "formal"


def test_unknown_session(client, engine):
    assert client.get("/api/sessions/NOPE99").status_code == 404


def test_consent_required(client, demo_session):
    r = client.post(
        "/api/runs", json={"session_code": demo_session, "consent": False, "consent_version": CONSENT}
    )
    assert r.status_code == 400


def test_run_hides_answers_for_test_items(client, demo_session):
    run = _start(client, demo_session)
    trials = run["trials"]
    assert [t["role"] for t in trials[:2]] == ["practice", "practice"]
    assert all(t["correct_response"] for t in trials[:2])
    assert all(t["correct_response"] is None for t in trials[2:])
    # Image file names are content hashes, so they do not reveal the item code.
    assert all("DEMO" not in t["image_url"] for t in trials)
    img = client.get(trials[0]["image_url"])
    assert img.status_code == 200 and img.headers["content-type"] == "image/png"


def test_full_run_scores_and_stores_trials(client, demo_session, db):
    run = _start(client, demo_session, identity={"name": "Test Person", "external_code": "T01"})
    rid = run["run_id"]
    # Answer every test item correctly, using the database to look up answers.
    db_run = db.query(m.TestRun).filter_by(public_id=rid).one()
    for t in db_run.trials:
        answer = "yes" if t.item.lexicality == m.Lexicality.real else "no"
        r = client.post(
            f"/api/runs/{rid}/responses",
            json={"position": t.position, "response": answer, "rt_ms": 700 + t.position,
                  "source": "key", "presented_at": "2026-11-09T08:00:00.123Z"},
        )
        assert r.status_code == 204, r.text
    r = client.post(f"/api/runs/{rid}/finish")
    assert r.status_code == 200
    body = r.json()
    assert body["answered"] == 8 and body["planned"] == 8
    assert body["scores"][0]["method"] == "lextale_avg"
    assert body["scores"][0]["value"] == 100.0

    db.rollback()  # end the read transaction so MySQL shows the new rows
    trials = db.query(m.Trial).filter_by(run_id=db_run.id).order_by(m.Trial.position).all()
    assert all(t.is_correct for t in trials)
    assert trials[0].presented_at.microsecond == 123000  # millisecond precision kept
    # Identity is stored apart from the run.
    ident = db.get(m.ParticipantIdentity, db_run.participant_id)
    assert ident.name == "Test Person"


def test_duplicate_and_late_responses(client, demo_session):
    rid = _start(client, demo_session)["run_id"]
    body = {"position": 2, "response": "yes", "rt_ms": 812, "source": "button"}
    assert client.post(f"/api/runs/{rid}/responses", json=body).status_code == 204
    # Same answer again (a retry) is accepted; a different one is not.
    assert client.post(f"/api/runs/{rid}/responses", json=body).status_code == 204
    body2 = {**body, "response": "no"}
    assert client.post(f"/api/runs/{rid}/responses", json=body2).status_code == 409
    assert client.post(f"/api/runs/{rid}/responses", json={**body, "position": 99}).status_code == 404
    client.post(f"/api/runs/{rid}/finish")
    assert client.post(f"/api/runs/{rid}/responses", json={**body, "position": 3}).status_code == 409


def test_research_mode_hides_score(client, db, demo_bank, media_dir):
    from app import cli

    cli.import_bank(db, demo_bank, demo_bank.parent, "v0", None, media_dir)
    cli.create_form(db, "pilot", "v0", "research", [], None, True)
    code = cli.create_session(db, "pilot", None).code
    db.commit()
    rid = _start(client, code)["run_id"]
    body = client.post(f"/api/runs/{rid}/finish").json()
    assert body["scores"] == [] and body["answered"] == 0
    # The score is still computed and stored for the researchers.
    run = db.query(m.TestRun).filter_by(public_id=rid).one()
    assert db.query(m.Score).filter_by(run_id=run.id).count() == 1


def test_order_is_randomized_per_run(client, demo_session):
    orders = {tuple(t["image_url"] for t in _start(client, demo_session)["trials"][2:]) for _ in range(8)}
    assert len(orders) > 1
