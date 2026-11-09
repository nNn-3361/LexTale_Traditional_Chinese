"""Endpoints used by the test page in the browser."""

from datetime import UTC

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models as m
from .. import schemas as s
from .. import services
from ..config import get_settings
from ..db import get_db

router = APIRouter(prefix="/api")


def _open_session(db: Session, code: str) -> m.TestSession:
    session = db.scalar(
        select(m.TestSession)
        .where(m.TestSession.code == code.strip().upper())
        .options(selectinload(m.TestSession.form).selectinload(m.TestForm.form_items))
    )
    if session is None or not session.is_open:
        raise HTTPException(404, "Session not found or closed")
    return session


def _get_run(db: Session, run_id: str) -> m.TestRun:
    run = db.scalar(select(m.TestRun).where(m.TestRun.public_id == run_id))
    if run is None:
        raise HTTPException(404, "Run not found")
    return run


@router.get("/sessions/{code}", response_model=s.SessionInfo)
def get_session(code: str, db: Session = Depends(get_db)) -> s.SessionInfo:
    session = _open_session(db, code)
    items = session.form.form_items
    return s.SessionInfo(
        code=session.code,
        label=session.label,
        mode=session.form.mode,
        consent_version=get_settings().consent_version,
        n_practice=sum(1 for fi in items if fi.role == m.ItemRole.practice),
        n_test=sum(1 for fi in items if fi.role == m.ItemRole.test),
    )


@router.post("/runs", response_model=s.RunOut, status_code=201)
def create_run(body: s.RunCreate, request: Request, db: Session = Depends(get_db)) -> s.RunOut:
    if not body.consent:
        raise HTTPException(400, "Consent is required")
    if body.consent_version != get_settings().consent_version:
        raise HTTPException(409, "Consent text has changed; reload the page")
    session = _open_session(db, body.session_code)
    run = services.start_run(
        db,
        session,
        consent_version=body.consent_version,
        identity=body.identity.model_dump() if body.identity else None,
        user_agent=request.headers.get("user-agent"),
    )
    trials = db.scalars(
        select(m.Trial)
        .where(m.Trial.run_id == run.id)
        .order_by(m.Trial.position)
        .options(selectinload(m.Trial.item))
    ).all()
    out = s.RunOut(
        run_id=run.public_id,
        mode=session.form.mode,
        trials=[
            s.TrialOut(
                position=t.position,
                role=t.role,
                image_url=f"/media/{t.item.image_path}",
                correct_response=(
                    services.correct_response(t.item) if t.role == m.ItemRole.practice else None
                ),
            )
            for t in trials
        ],
    )
    db.commit()
    return out


@router.post("/runs/{run_id}/responses", status_code=204)
def save_response(run_id: str, body: s.ResponseIn, db: Session = Depends(get_db)) -> None:
    run = _get_run(db, run_id)
    if run.finished_at is not None:
        raise HTTPException(409, "Run already finished")
    trial = db.scalar(
        select(m.Trial)
        .where(m.Trial.run_id == run.id, m.Trial.position == body.position)
        .options(selectinload(m.Trial.item))
    )
    if trial is None:
        raise HTTPException(404, "No trial at this position")
    if trial.response is not None:
        # The browser may retry after a network error; the same answer is fine.
        if trial.response == body.response and trial.rt_ms == body.rt_ms:
            return None
        raise HTTPException(409, "This trial already has a response")
    trial.response = body.response
    trial.is_correct = body.response == services.correct_response(trial.item)
    trial.rt_ms = body.rt_ms
    trial.response_source = body.source
    trial.presented_at = (
        body.presented_at.astimezone(UTC).replace(tzinfo=None)
        if body.presented_at and body.presented_at.tzinfo
        else body.presented_at
    )
    trial.received_at = m.utcnow()
    db.commit()
    return None


@router.post("/runs/{run_id}/finish", response_model=s.FinishOut)
def finish_run(run_id: str, db: Session = Depends(get_db)) -> s.FinishOut:
    run = _get_run(db, run_id)
    if run.finished_at is None:
        run.finished_at = m.utcnow()
    scores = services.compute_scores(db, run)
    trials = run.trials
    out = s.FinishOut(
        run_id=run.public_id,
        answered=sum(1 for t in trials if t.role == m.ItemRole.test and t.response),
        planned=sum(1 for t in trials if t.role == m.ItemRole.test),
        scores=(
            [
                s.ScoreOut(method=x.method, formula_version=x.formula_version, value=float(x.value))
                for x in scores
            ]
            if run.form.mode == m.FormMode.formal
            else []
        ),
    )
    db.commit()
    return out
