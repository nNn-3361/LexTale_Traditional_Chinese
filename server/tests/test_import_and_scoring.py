import csv

import pytest
from PIL import Image

from app import cli
from app import models as m
from app.scoring import lextale_average


def test_import_creates_version(db, demo_bank, media_dir):
    v = cli.import_bank(db, demo_bank, demo_bank.parent, "v0", "first", media_dir)
    db.commit()
    assert len(v.items) == 10
    real = db.query(m.Item).filter_by(item_code="DEMO-R01").one()
    assert real.character == "甲" and real.lexicality == m.Lexicality.real
    assert real.attributes["font"] == "demo"
    assert (media_dir / real.image_path).is_file()
    assert db.query(m.Item).filter_by(item_code="DEMO-P01").one().character is None


def test_reimport_reuses_items_and_rejects_changed_ones(db, demo_bank, media_dir):
    cli.import_bank(db, demo_bank, demo_bank.parent, "v0", None, media_dir)
    v1 = cli.import_bank(db, demo_bank, demo_bank.parent, "v1", None, media_dir)
    db.commit()
    assert db.query(m.Item).count() == 10 and len(v1.items) == 10
    with pytest.raises(cli.CliError, match="already exists"):
        cli.import_bank(db, demo_bank, demo_bank.parent, "v1", None, media_dir)
    # Change one image but keep its code.
    Image.new("RGB", (10, 10), "red").save(demo_bank.parent / "DEMO-R01.png")
    with pytest.raises(cli.CliError, match="DEMO-R01: differs"):
        cli.import_bank(db, demo_bank, demo_bank.parent, "v2", None, media_dir)


def test_bad_item_list_reports_all_problems(tmp_path, media_dir, db):
    p = tmp_path / "items.csv"
    with p.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["item_id", "lexicality", "char", "image"])
        w.writerow(["R1", "real", "", "missing.png"])
        w.writerow(["R1", "word", "", "x.png"])
    with pytest.raises(cli.CliError) as e:
        cli.import_bank(db, p, tmp_path, "v0", None, media_dir)
    msg = str(e.value)
    for part in ("real item without char", "duplicate item_id", "lexicality must be", "image not found"):
        assert part in msg


def test_create_form_checks(db, demo_bank, media_dir):
    cli.import_bank(db, demo_bank, demo_bank.parent, "v0", None, media_dir)
    with pytest.raises(cli.CliError, match="Not in version"):
        cli.create_form(db, "f", "v0", "research", ["NOPE"], None, True)
    with pytest.raises(cli.CliError, match="both practice and test"):
        cli.create_form(db, "f", "v0", "research", ["DEMO-R01"], ["DEMO-R01"], True)
    f = cli.create_form(db, "f", "v0", "research", ["DEMO-R01"], ["DEMO-R02", "DEMO-P02"], False)
    assert [fi.item.item_code for fi in f.form_items] == ["DEMO-R01", "DEMO-R02", "DEMO-P02"]


def _trial(lex, correct, role=m.ItemRole.test):
    t = m.Trial(role=role, is_correct=correct, response=m.Response.yes if correct is not None else None)
    t.item = m.Item(lexicality=lex)
    return t


def test_lextale_average():
    trials = (
        [_trial(m.Lexicality.real, True)] * 3
        + [_trial(m.Lexicality.real, False)]  # real: 3/4 = 75%
        + [_trial(m.Lexicality.pseudo, True)]
        + [_trial(m.Lexicality.pseudo, None)]  # pseudo: 1/2 = 50%, unanswered is wrong
        + [_trial(m.Lexicality.pseudo, False, role=m.ItemRole.practice)]  # ignored
    )
    r = lextale_average(trials)
    assert r.value == 62.5
    assert r.details["real_total"] == 4 and r.details["pseudo_total"] == 2
