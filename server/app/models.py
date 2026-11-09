"""Database tables.

Target database: MySQL 8.0 or later, character set utf8mb4. Columns that hold
Chinese characters use the binary collation utf8mb4_bin, so that two different
characters are never treated as equal. Times are stored as DATETIME(3)
(millisecond precision, UTC).

Overview:

- Item bank: items, item_bank_versions, bank_version_items
- Test forms: test_forms, form_items
- Administration: test_sessions, participants, participant_identities
- Results: test_runs, trials, scores

Identifiable participant information lives only in participant_identities, so
that analysis exports can be made from the other tables without it.
"""

from __future__ import annotations

import enum
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# --- column types --------------------------------------------------------

# DATETIME(3) on MySQL, plain DateTime elsewhere (SQLite in quick tests).
DateTime3 = DateTime().with_variant(mysql.DATETIME(fsp=3), "mysql")

# BIGINT primary keys on MySQL; SQLite needs INTEGER for autoincrement.
BigId = BigInteger().with_variant(Integer(), "sqlite")


def CharText(length: int) -> Any:
    """VARCHAR with the utf8mb4_bin collation on MySQL, for Chinese characters."""
    return String(length).with_variant(
        mysql.VARCHAR(length, charset="utf8mb4", collation="utf8mb4_bin"), "mysql"
    )


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


TABLE_ARGS = {
    "mysql_engine": "InnoDB",
    "mysql_charset": "utf8mb4",
    "mysql_collate": "utf8mb4_0900_ai_ci",
}


class Lexicality(str, enum.Enum):
    real = "real"
    pseudo = "pseudo"


class FormMode(str, enum.Enum):
    research = "research"  # pilot and validation studies; no score shown
    formal = "formal"  # public use; score shown at the end


class ItemRole(str, enum.Enum):
    practice = "practice"  # shown first, with feedback, not scored
    test = "test"


class Response(str, enum.Enum):
    yes = "yes"  # "this is a real character"
    no = "no"


# --- item bank -----------------------------------------------------------


class Item(Base):
    """One stimulus. An item never changes once used: a new image means a new item code."""

    __tablename__ = "items"
    __table_args__ = TABLE_ARGS

    id: Mapped[int] = mapped_column(BigId, primary_key=True, autoincrement=True)
    item_code: Mapped[str] = mapped_column(String(32), unique=True)
    lexicality: Mapped[Lexicality] = mapped_column(Enum(Lexicality, native_enum=True))
    # The real character; NULL for pseudo-characters, which have no code point.
    character: Mapped[str | None] = mapped_column(CharText(8), nullable=True)
    # Path relative to MEDIA_DIR, for example "items/3f2a...png".
    image_path: Mapped[str] = mapped_column(String(255))
    image_sha256: Mapped[str] = mapped_column(String(64))
    # Everything else from the item list (source characters, structure, font,
    # frequency band, stroke count ...). Kept as JSON so new columns in the
    # item list do not need a schema change.
    attributes: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime3, default=utcnow)


class ItemBankVersion(Base):
    __tablename__ = "item_bank_versions"
    __table_args__ = TABLE_ARGS

    id: Mapped[int] = mapped_column(BigId, primary_key=True, autoincrement=True)
    label: Mapped[str] = mapped_column(String(32), unique=True)  # "v0", "v1" ...
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime3, default=utcnow)

    items: Mapped[list[Item]] = relationship(secondary="bank_version_items")


class BankVersionItem(Base):
    __tablename__ = "bank_version_items"
    __table_args__ = TABLE_ARGS

    version_id: Mapped[int] = mapped_column(
        ForeignKey("item_bank_versions.id", ondelete="CASCADE"), primary_key=True
    )
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), primary_key=True)


# --- test forms ----------------------------------------------------------


class TestForm(Base):
    """A set of items given together: a pilot sub-form or the final test."""

    __test__ = False  # not a pytest test class

    __tablename__ = "test_forms"
    __table_args__ = TABLE_ARGS

    id: Mapped[int] = mapped_column(BigId, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), unique=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("item_bank_versions.id"))
    mode: Mapped[FormMode] = mapped_column(Enum(FormMode, native_enum=True))
    randomize: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime3, default=utcnow)

    version: Mapped[ItemBankVersion] = relationship()
    form_items: Mapped[list[FormItem]] = relationship(
        order_by="FormItem.position", cascade="all, delete-orphan"
    )


class FormItem(Base):
    __tablename__ = "form_items"
    __table_args__ = (UniqueConstraint("form_id", "item_id"), TABLE_ARGS)

    id: Mapped[int] = mapped_column(BigId, primary_key=True, autoincrement=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("test_forms.id", ondelete="CASCADE"))
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"))
    role: Mapped[ItemRole] = mapped_column(Enum(ItemRole, native_enum=True))
    # Order in the item list; used when randomize is off, and for practice items.
    position: Mapped[int] = mapped_column(Integer)

    item: Mapped[Item] = relationship()


# --- administration ------------------------------------------------------


class TestSession(Base):
    """A sitting opened by a teacher or researcher; participants join with its code."""

    __test__ = False  # not a pytest test class

    __tablename__ = "test_sessions"
    __table_args__ = TABLE_ARGS

    id: Mapped[int] = mapped_column(BigId, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(16), unique=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("test_forms.id"))
    label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime3, default=utcnow)

    form: Mapped[TestForm] = relationship()


class Participant(Base):
    """Anonymous participant. public_id is what analysis exports use."""

    __tablename__ = "participants"
    __table_args__ = TABLE_ARGS

    id: Mapped[int] = mapped_column(BigId, primary_key=True, autoincrement=True)
    public_id: Mapped[str] = mapped_column(String(36), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime3, default=utcnow)


class ParticipantIdentity(Base):
    """Identifiable information. Kept apart from responses; never exported for analysis."""

    __tablename__ = "participant_identities"
    __table_args__ = TABLE_ARGS

    participant_id: Mapped[int] = mapped_column(
        ForeignKey("participants.id", ondelete="CASCADE"), primary_key=True
    )
    name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    student_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Code the team uses to link this person to their proficiency test score.
    external_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime3, default=utcnow)


# --- results -------------------------------------------------------------


class TestRun(Base):
    """One participant taking one form once."""

    __test__ = False  # not a pytest test class

    __tablename__ = "test_runs"
    __table_args__ = TABLE_ARGS

    id: Mapped[int] = mapped_column(BigId, primary_key=True, autoincrement=True)
    # Random token given to the browser; the numeric id is never exposed.
    public_id: Mapped[str] = mapped_column(String(36), unique=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id"))
    session_id: Mapped[int] = mapped_column(ForeignKey("test_sessions.id"))
    form_id: Mapped[int] = mapped_column(ForeignKey("test_forms.id"))
    # Copied from the form so each run records the item bank version it used.
    version_id: Mapped[int] = mapped_column(ForeignKey("item_bank_versions.id"))
    consent_version: Mapped[str] = mapped_column(String(32))
    consented_at: Mapped[datetime] = mapped_column(DateTime3)
    started_at: Mapped[datetime] = mapped_column(DateTime3, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime3, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)

    form: Mapped[TestForm] = relationship()
    trials: Mapped[list[Trial]] = relationship(order_by="Trial.position")


class Trial(Base):
    """One planned presentation in a run, and the response to it.

    Rows are created when the run starts, in the order the items will be shown
    (practice first, then test items in random order). The response columns are
    filled when the browser sends the answer, so an unfinished run still shows
    which items were planned and which were answered.
    """

    __tablename__ = "trials"
    __table_args__ = (UniqueConstraint("run_id", "position"), TABLE_ARGS)

    id: Mapped[int] = mapped_column(BigId, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("test_runs.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)  # 0-based order of presentation
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"))
    role: Mapped[ItemRole] = mapped_column(Enum(ItemRole, native_enum=True))
    response: Mapped[Response | None] = mapped_column(
        Enum(Response, native_enum=True), nullable=True
    )
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    # Reaction time measured in the browser by jsPsych, in milliseconds.
    rt_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # "key" or "button"
    response_source: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # Browser clock time when the image appeared (sent by the client).
    presented_at: Mapped[datetime | None] = mapped_column(DateTime3, nullable=True)
    # Server time when the response arrived.
    received_at: Mapped[datetime | None] = mapped_column(DateTime3, nullable=True)

    item: Mapped[Item] = relationship()


class Score(Base):
    """A score for a run. Scores are computed by the server and can be recomputed."""

    __tablename__ = "scores"
    __table_args__ = (
        UniqueConstraint("run_id", "method", "formula_version"),
        TABLE_ARGS,
    )

    id: Mapped[int] = mapped_column(BigId, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("test_runs.id", ondelete="CASCADE"))
    method: Mapped[str] = mapped_column(String(32))  # for example "lextale_avg"
    formula_version: Mapped[int] = mapped_column(Integer)
    value: Mapped[float] = mapped_column(Numeric(7, 4))
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    computed_at: Mapped[datetime] = mapped_column(DateTime3, default=utcnow)
