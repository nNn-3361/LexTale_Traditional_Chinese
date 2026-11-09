"""Settings read from environment variables.

Never put real credentials in this file. Use a `.env` file (not committed)
or the environment of the server.
"""

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    database_url: str
    media_dir: Path
    web_dist: Path | None
    # Version label of the consent text shown in the browser (web/src/text.ts).
    consent_version: str


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"{name} is not set. Example: "
            "mysql+pymysql://USER:PASSWORD@127.0.0.1:3306/lextale?charset=utf8mb4"
        )
    return value


def get_settings() -> Settings:
    web_dist = os.environ.get("WEB_DIST")
    return Settings(
        database_url=_require("DATABASE_URL"),
        media_dir=Path(os.environ.get("MEDIA_DIR", "media")).resolve(),
        web_dist=Path(web_dist).resolve() if web_dist else None,
        consent_version=os.environ.get("CONSENT_VERSION", "draft-0"),
    )
