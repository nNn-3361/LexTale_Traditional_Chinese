"""Logic shared by the API and the command line tools."""

import random
import secrets
import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from . import models as m
from .scoring import score_trials

# Without 0/O and 1/I/L, so codes are easy to read aloud in class.
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def new_session_code(length: int = 6) -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))


def plan_trials(form: m.TestForm, rng: random.Random | None = None) -> list[m.FormItem]:
    """Practice items in list order, then test items (shuffled if the form says so)."""
    rng = rng or random.SystemRandom()
    practice = [fi for fi in form.form_items if fi.role == m.ItemRole.practice]
    test = [fi for fi in form.form_items if fi.role == m.ItemRole.test]
    if form.randomize:
        rng.shuffle(test)
    return practice + test


def correct_response(item: m.Item) -> m.Response:
    return m.Response.yes if item.lexicality == m.Lexicality.real else m.Response.no


def start_run(
    db: Session,
    session: m.TestSession,
    consent_version: str,
    identity: dict | None,
    user_agent: str | None,
) -> m.TestRun:
    participant = m.Participant(public_id=str(uuid.uuid4()))
    db.add(participant)
    db.flush()
    if identity and any(identity.values()):
        db.add(m.ParticipantIdentity(participant_id=participant.id, **identity))

    form = session.form
    run = m.TestRun(
        public_id=str(uuid.uuid4()),
        participant_id=participant.id,
        session_id=session.id,
        form_id=form.id,
        version_id=form.version_id,
        consent_version=consent_version,
        consented_at=m.utcnow(),
        user_agent=(user_agent or "")[:512] or None,
    )
    db.add(run)
    db.flush()
    for pos, fi in enumerate(plan_trials(form)):
        db.add(m.Trial(run_id=run.id, position=pos, item_id=fi.item_id, role=fi.role))
    db.flush()
    db.refresh(run)
    return run


def compute_scores(db: Session, run: m.TestRun) -> list[m.Score]:
    """(Re)compute and store every score for a run."""
    trials = db.scalars(
        select(m.Trial).where(m.Trial.run_id == run.id).options(selectinload(m.Trial.item))
    ).all()
    results = score_trials(list(trials))
    db.execute(delete(m.Score).where(m.Score.run_id == run.id))
    rows = [
        m.Score(
            run_id=run.id,
            method=r.method,
            formula_version=r.formula_version,
            value=r.value,
            details=r.details,
        )
        for r in results
    ]
    db.add_all(rows)
    db.flush()
    return rows
