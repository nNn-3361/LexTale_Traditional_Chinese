from datetime import datetime

from pydantic import BaseModel, Field

from .models import FormMode, ItemRole, Response


class SessionInfo(BaseModel):
    code: str
    label: str | None
    mode: FormMode
    consent_version: str
    n_practice: int
    n_test: int


class IdentityIn(BaseModel):
    name: str | None = Field(default=None, max_length=128)
    student_id: str | None = Field(default=None, max_length=64)
    email: str | None = Field(default=None, max_length=255)
    external_code: str | None = Field(default=None, max_length=64)


class RunCreate(BaseModel):
    session_code: str = Field(max_length=16)
    consent: bool
    consent_version: str = Field(max_length=32)
    identity: IdentityIn | None = None


class TrialOut(BaseModel):
    position: int
    role: ItemRole
    image_url: str
    # Only given for practice trials, so the browser can show feedback.
    # Test trials never reveal the answer to the browser.
    correct_response: Response | None = None


class RunOut(BaseModel):
    run_id: str
    mode: FormMode
    trials: list[TrialOut]


class ResponseIn(BaseModel):
    position: int = Field(ge=0)
    response: Response
    rt_ms: int = Field(ge=0, le=600_000)
    source: str = Field(pattern="^(key|button)$")
    presented_at: datetime | None = None


class ScoreOut(BaseModel):
    method: str
    formula_version: int
    value: float


class FinishOut(BaseModel):
    run_id: str
    answered: int
    planned: int
    # Empty in research mode; the score is not shown to participants there.
    scores: list[ScoreOut]
