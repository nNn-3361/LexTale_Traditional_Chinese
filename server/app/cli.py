"""Command line tools for the team.

Run from the server/ folder, with DATABASE_URL and MEDIA_DIR set:

    python -m app.cli import-bank --csv items.csv --images images/ --version v0
    python -m app.cli create-form --name pilot-A --version v0 --mode research --practice R001,P001
    python -m app.cli create-session --form pilot-A --label "Class 1"
    python -m app.cli close-session --code ABC234
    python -m app.cli rescore

Items are never written into the code. The item list (items.csv, in the format
exported by stimuli/tools/pseudo-character-maker) and its images are imported
as a new item bank version each time the bank changes.
"""

import argparse
import csv
import hashlib
import shutil
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models as m
from . import services
from .config import get_settings
from .db import session_factory

REQUIRED_COLUMNS = {"item_id", "lexicality", "char", "image"}
IMAGE_TYPES = {".png", ".svg", ".jpg", ".jpeg", ".webp"}


class CliError(Exception):
    pass


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 16), b""):
            h.update(block)
    return h.hexdigest()


def read_item_list(csv_path: Path, image_dir: Path) -> list[dict]:
    """Read and check items.csv. Raises CliError listing every problem found."""
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if missing:
            raise CliError(f"{csv_path}: missing columns: {', '.join(sorted(missing))}")
        rows = list(reader)

    image_root = image_dir.resolve()
    errors, items, seen = [], [], set()
    for n, row in enumerate(rows, start=2):  # line 1 is the header
        code = (row["item_id"] or "").strip()
        lex = (row["lexicality"] or "").strip()
        char = (row["char"] or "").strip() or None
        image = (image_dir / (row["image"] or "").strip()).resolve()
        where = f"line {n} ({code or 'no item_id'})"
        if not code:
            errors.append(f"{where}: empty item_id")
        elif code in seen:
            errors.append(f"{where}: duplicate item_id")
        seen.add(code)
        if lex not in ("real", "pseudo"):
            errors.append(f"{where}: lexicality must be 'real' or 'pseudo'")
        if lex == "real" and not char:
            errors.append(f"{where}: real item without char")
        if lex == "pseudo" and char:
            errors.append(f"{where}: pseudo item should have an empty char")
        if not image.is_relative_to(image_root):
            errors.append(f"{where}: image must be inside {image_root}")
        elif not image.is_file():
            errors.append(f"{where}: image not found: {image}")
        elif image.suffix.lower() not in IMAGE_TYPES:
            errors.append(f"{where}: unsupported image type {image.suffix}")
        attrs = {
            k: v for k, v in row.items() if k not in REQUIRED_COLUMNS and k is not None and v != ""
        }
        items.append(
            {"code": code, "lexicality": lex, "char": char, "image": image, "attributes": attrs}
        )
    if errors:
        raise CliError("Item list has problems:\n  " + "\n  ".join(errors))
    if not items:
        raise CliError("Item list is empty")
    return items


def import_bank(
    db: Session, csv_path: Path, image_dir: Path, label: str, notes: str | None, media_dir: Path
) -> m.ItemBankVersion:
    if db.scalar(select(m.ItemBankVersion).where(m.ItemBankVersion.label == label)):
        raise CliError(f"Item bank version {label!r} already exists")
    rows = read_item_list(csv_path, image_dir)

    errors, to_copy, items = [], [], []
    for r in rows:
        sha = _sha256(r["image"])
        existing = db.scalar(select(m.Item).where(m.Item.item_code == r["code"]))
        if existing is not None:
            # An item code always means the same stimulus, so old responses stay valid.
            if (
                existing.lexicality.value != r["lexicality"]
                or existing.character != r["char"]
                or existing.image_sha256 != sha
            ):
                errors.append(
                    f"{r['code']}: differs from the item already stored under this code "
                    "(lexicality, char or image). Give the changed item a new item_id."
                )
            items.append(existing)
            continue
        rel = f"items/{sha}{r['image'].suffix.lower()}"
        to_copy.append((r["image"], media_dir / rel))
        item = m.Item(
            item_code=r["code"],
            lexicality=m.Lexicality(r["lexicality"]),
            character=r["char"],
            image_path=rel,
            image_sha256=sha,
            attributes=r["attributes"],
        )
        db.add(item)
        items.append(item)
    if errors:
        raise CliError("Cannot import:\n  " + "\n  ".join(errors))

    version = m.ItemBankVersion(label=label, notes=notes, items=items)
    db.add(version)
    db.flush()
    for src, dst in to_copy:
        dst.parent.mkdir(parents=True, exist_ok=True)
        if not dst.exists():
            shutil.copyfile(src, dst)
    return version


def _parse_codes(value: str | None) -> list[str]:
    if not value:
        return []
    path = Path(value)
    text = path.read_text(encoding="utf-8-sig") if path.is_file() else value
    return [c.strip() for c in text.replace(",", "\n").splitlines() if c.strip()]


def create_form(
    db: Session,
    name: str,
    label: str,
    mode: str,
    practice: list[str],
    test: list[str] | None,
    randomize: bool,
) -> m.TestForm:
    version = db.scalar(select(m.ItemBankVersion).where(m.ItemBankVersion.label == label))
    if version is None:
        raise CliError(f"No item bank version {label!r}")
    if db.scalar(select(m.TestForm).where(m.TestForm.name == name)):
        raise CliError(f"Form {name!r} already exists")
    by_code = {i.item_code: i for i in version.items}
    unknown = [c for c in practice + (test or []) if c not in by_code]
    if unknown:
        raise CliError(f"Not in version {label}: {', '.join(unknown)}")
    if test is None:
        test = [c for c in by_code if c not in practice]
    overlap = set(practice) & set(test)
    if overlap:
        raise CliError(f"Items listed as both practice and test: {', '.join(sorted(overlap))}")
    if not test:
        raise CliError("Form has no test items")

    form = m.TestForm(name=name, version=version, mode=m.FormMode(mode), randomize=randomize)
    pos = 0
    for role, codes in ((m.ItemRole.practice, practice), (m.ItemRole.test, test)):
        for c in codes:
            form.form_items.append(m.FormItem(item=by_code[c], role=role, position=pos))
            pos += 1
    db.add(form)
    db.flush()
    return form


def create_session(db: Session, form_name: str, label: str | None) -> m.TestSession:
    form = db.scalar(select(m.TestForm).where(m.TestForm.name == form_name))
    if form is None:
        raise CliError(f"No form {form_name!r}")
    for _ in range(20):
        code = services.new_session_code()
        if not db.scalar(select(m.TestSession).where(m.TestSession.code == code)):
            break
    session = m.TestSession(code=code, form=form, label=label)
    db.add(session)
    db.flush()
    return session


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m app.cli")
    sub = p.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("import-bank", help="import items.csv and images as a new bank version")
    a.add_argument("--csv", type=Path, required=True)
    a.add_argument("--images", type=Path, help="folder with the images (default: next to the CSV)")
    a.add_argument("--version", required=True, help="version label, for example v0")
    a.add_argument("--notes")

    f = sub.add_parser("create-form", help="create a test form from a bank version")
    f.add_argument("--name", required=True)
    f.add_argument("--version", required=True)
    f.add_argument("--mode", choices=[x.value for x in m.FormMode], required=True)
    f.add_argument("--practice", help="practice item codes: comma list or a file, one per line")
    f.add_argument("--items", help="test item codes (default: every other item in the version)")
    f.add_argument("--no-randomize", action="store_true", help="keep the listed order")

    s = sub.add_parser("create-session", help="open a session and print its code")
    s.add_argument("--form", required=True)
    s.add_argument("--label")

    c = sub.add_parser("close-session")
    c.add_argument("--code", required=True)

    sub.add_parser("rescore", help="recompute the scores of every finished run")

    args = p.parse_args(argv)
    db = session_factory()()
    try:
        if args.cmd == "import-bank":
            v = import_bank(
                db,
                args.csv,
                args.images or args.csv.parent,
                args.version,
                args.notes,
                get_settings().media_dir,
            )
            db.commit()
            print(f"Imported version {v.label} with {len(v.items)} items")
        elif args.cmd == "create-form":
            form = create_form(
                db,
                args.name,
                args.version,
                args.mode,
                _parse_codes(args.practice),
                _parse_codes(args.items) or None,
                not args.no_randomize,
            )
            db.commit()
            n_prac = sum(1 for fi in form.form_items if fi.role == m.ItemRole.practice)
            print(f"Created form {form.name}: {n_prac} practice, {len(form.form_items) - n_prac} test")
        elif args.cmd == "create-session":
            session = create_session(db, args.form, args.label)
            db.commit()
            print(session.code)
        elif args.cmd == "close-session":
            session = db.scalar(select(m.TestSession).where(m.TestSession.code == args.code))
            if session is None:
                raise CliError(f"No session {args.code!r}")
            session.is_open = False
            db.commit()
            print(f"Closed {session.code}")
        elif args.cmd == "rescore":
            runs = db.scalars(select(m.TestRun).where(m.TestRun.finished_at.is_not(None))).all()
            for run in runs:
                services.compute_scores(db, run)
            db.commit()
            print(f"Rescored {len(runs)} runs")
    except CliError as e:
        db.rollback()
        print(f"Error: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
