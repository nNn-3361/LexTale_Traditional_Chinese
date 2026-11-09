"""Test setup.

By default tests use an in-memory SQLite database. To run them against MySQL
(recommended before merging changes to the models), set TEST_DATABASE_URL to an
empty MySQL database, for example:

    TEST_DATABASE_URL="mysql+pymysql://lextale:lextale@127.0.0.1:3306/lextale_test?charset=utf8mb4"

All tables in that database are dropped and recreated.
"""

import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))


@pytest.fixture()
def media_dir(tmp_path, monkeypatch):
    d = tmp_path / "media"
    monkeypatch.setenv("MEDIA_DIR", str(d))
    return d


@pytest.fixture()
def engine(media_dir):
    from app import db as dbmod
    from app.models import Base

    url = os.environ.get("TEST_DATABASE_URL", "sqlite://")
    kwargs = {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {}
    eng = create_engine(url, **kwargs)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    dbmod.set_engine(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def db(engine):
    from app.db import session_factory

    s = session_factory()()
    yield s
    s.close()


@pytest.fixture()
def demo_bank(tmp_path):
    from make_demo_bank import make

    return make(tmp_path / "bank", n_real=6, n_pseudo=4)


@pytest.fixture()
def demo_session(db, demo_bank, media_dir):
    """Import the demo bank as v0, make a formal form with 2 practice items, open a session."""
    from app import cli

    cli.import_bank(db, demo_bank, demo_bank.parent, "v0", None, media_dir)
    cli.create_form(db, "demo", "v0", "formal", ["DEMO-R01", "DEMO-P01"], None, True)
    session = cli.create_session(db, "demo", "test class")
    db.commit()
    return session.code


@pytest.fixture()
def client(engine):
    from fastapi.testclient import TestClient

    from app.main import create_app

    return TestClient(create_app())
