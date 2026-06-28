"""
main.py — GPS tracking service (FastAPI).

A bus device / driver's phone app posts coordinates here; we validate the device
key and write them into Supabase (bus_locations). The web app reads live.

  GET  /health
  POST /ping   header: X-Device-Key
       body: { route_id, latitude, longitude, speed_kmh?, heading?, recorded_at? }
"""

import hmac
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import FastAPI, Header, HTTPException, Response
from pydantic import BaseModel, Field

import store
from core.config import get_settings
from core.logging import setup_logging, get_logger

settings = get_settings()
setup_logging(settings.log_level, settings.log_format)
logger = get_logger("gps-tracking")

if not settings.device_api_key or settings.device_api_key == "CHANGE_ME":
    logger.warning("DEVICE_API_KEY is unset/default — set a strong secret before production.")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        store.drain_spool()  # flush anything buffered while we were down
    except Exception as e:  # noqa: BLE001
        logger.error("spool drain on startup failed: %s", e)
    yield


app = FastAPI(title="GPS Tracking Service", version="1.0", lifespan=lifespan)


class Ping(BaseModel):
    route_id: UUID
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    speed_kmh: Optional[float] = Field(default=None, ge=0)
    heading: Optional[float] = Field(default=None, ge=0, le=360)
    recorded_at: Optional[datetime] = None   # defaults to now (UTC)


def _check_key(x_device_key: Optional[str]) -> None:
    expected = settings.device_api_key or ""
    if not x_device_key or not hmac.compare_digest(x_device_key, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing X-Device-Key")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "school_id": settings.school_id}


@app.get("/ready")
def ready(response: Response) -> dict:
    """Readiness probe: can we reach Supabase?"""
    try:
        store.get_client().table("bus_locations").select("id").limit(1).execute()
        return {"ready": True}
    except Exception:  # noqa: BLE001
        response.status_code = 503
        return {"ready": False}


@app.post("/ping")
def ping(body: Ping, x_device_key: Optional[str] = Header(default=None)) -> dict:
    _check_key(x_device_key)
    result = store.insert_location(
        route_id=str(body.route_id),
        latitude=body.latitude,
        longitude=body.longitude,
        speed_kmh=body.speed_kmh,
        heading=body.heading,
        recorded_at=body.recorded_at.isoformat() if body.recorded_at else None,
    )
    logger.info("ping route=%s lat=%.5f lng=%.5f%s",
                body.route_id, body.latitude, body.longitude,
                " (spooled)" if result.get("spooled") else "")
    return result


def main() -> None:
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)


if __name__ == "__main__":
    main()
