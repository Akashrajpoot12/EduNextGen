"""
api/main.py
───────────
Minimal FastAPI for the face-attendance service.

  GET  /health
  POST /register   (multipart: entity_type, entity_id, overwrite, files[])
  POST /recognize  (multipart: file, mark)

The web SMS app (or a kiosk page) can call these. The service itself writes
straight into Supabase.
"""

from contextlib import asynccontextmanager
from typing import List, Optional

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from core.config import get_settings
from core.logging import setup_logging, get_logger
from ml.models import get_models
from service import registration, recognition

settings = get_settings()
setup_logging(settings.log_level, settings.log_format)
logger = get_logger("face-attendance.api")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Preload models once at startup: fail fast on a bad model dir and avoid a
    # slow/racy first request.
    try:
        get_models()
        logger.info("Face models preloaded")
    except Exception as e:  # noqa: BLE001
        logger.error("Model preload failed (will retry on first request): %s", e)
    yield


app = FastAPI(title="Face Attendance Service", version="1.0", lifespan=lifespan)

# Allow the web admin (and kiosk pages) to call /register and /recognize from
# the browser. Tighten allow_origins to your school's domain(s) in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


if not settings.service_api_key:
    logger.warning("SERVICE_API_KEY is not set — /register and /recognize are UNAUTHENTICATED. "
                   "Set SERVICE_API_KEY in .env and restrict network access before production.")


def _require_key(x_service_key: Optional[str]) -> None:
    """Reject calls without the shared secret (when one is configured)."""
    if settings.service_api_key and x_service_key != settings.service_api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Service-Key")


def _decode(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")
    return img


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "school_id": settings.school_id}


@app.get("/ready")
def ready() -> dict:
    """Readiness probe: models loaded yet? (Liveness is /health.)"""
    from ml.models import ready as models_ready
    ok = models_ready()
    return {"ready": ok}


@app.post("/register")
async def register(
    entity_type: str = Form(...),
    entity_id: str = Form(...),
    overwrite: bool = Form(False),
    files: List[UploadFile] = File(...),
    x_service_key: Optional[str] = Header(default=None),
) -> dict:
    _require_key(x_service_key)
    if entity_type not in ("student", "staff"):
        raise HTTPException(status_code=400, detail="entity_type must be 'student' or 'staff'")
    if not files:
        raise HTTPException(status_code=400, detail="At least one photo is required")
    if len(files) > settings.max_enrollment_images:
        raise HTTPException(status_code=413, detail=f"Too many photos (max {settings.max_enrollment_images})")

    frames = [_decode(await f.read()) for f in files]
    # CPU-bound inference → run off the event loop.
    return await run_in_threadpool(
        registration.register_frames,
        entity_type=entity_type, entity_id=entity_id, frames=frames, overwrite=overwrite,
    )


@app.post("/recognize")
async def recognize(
    file: UploadFile = File(...),
    mark: bool = Form(True),
    x_service_key: Optional[str] = Header(default=None),
) -> dict:
    _require_key(x_service_key)
    frame = _decode(await file.read())
    events = await run_in_threadpool(recognition.recognise_frame, frame, mark=mark)
    return {"events": events}


def main() -> None:
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)


if __name__ == "__main__":
    main()
