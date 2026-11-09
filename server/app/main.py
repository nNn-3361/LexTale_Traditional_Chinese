from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .routers import runs


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="LexTALE Traditional Chinese")
    app.include_router(runs.router)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    Path(settings.media_dir).mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
    # In production the built test page (web/dist) is served from the same origin.
    if settings.web_dist and settings.web_dist.is_dir():
        app.mount("/", StaticFiles(directory=settings.web_dist, html=True), name="web")
    return app


app = create_app()
