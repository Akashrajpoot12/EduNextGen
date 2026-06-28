"""
store.py — Supabase access for the GPS service, with a local durability spool.

Inserts bus coordinates into public.bus_locations (service_role key, bypasses RLS).
If Supabase is unreachable, pings are appended to a local JSONL spool and drained
later so location data is never silently lost.
"""

import json
import os
import threading
import time
from datetime import datetime, timezone
from typing import Optional

from supabase import create_client, Client

from core.config import get_settings
from core.logging import get_logger

settings = get_settings()
logger = get_logger("gps.store")

_client: Optional[Client] = None
_spool_lock = threading.Lock()
SPOOL = settings.spool_path


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client


def _build_row(*, route_id: str, latitude: float, longitude: float,
               speed_kmh: Optional[float], heading: Optional[float],
               recorded_at: Optional[str]) -> dict:
    return {
        "school_id": settings.school_id,
        "route_id": route_id,
        "latitude": latitude,
        "longitude": longitude,
        "speed_kmh": speed_kmh,
        "heading": heading,
        "recorded_at": recorded_at or datetime.now(timezone.utc).isoformat(),
    }


def _insert(row: dict, attempts: int = 2) -> dict:
    last = None
    for i in range(attempts):
        try:
            res = get_client().table("bus_locations").insert(row).execute()
            return (res.data or [{}])[0]
        except Exception as e:  # noqa: BLE001
            last = e
            if i < attempts - 1:
                time.sleep(0.4 * (2 ** i))
    raise last


def insert_location(**kwargs) -> dict:
    row = _build_row(**kwargs)
    try:
        out = _insert(row)
        return {"ok": True, "id": out.get("id")}
    except Exception as e:  # noqa: BLE001 — DB unreachable: spool instead of losing data
        _spool(row)
        logger.error("ping spooled (DB error): %s", e)
        return {"ok": True, "spooled": True}


def _spool(row: dict) -> None:
    with _spool_lock:
        with open(SPOOL, "a", encoding="utf-8") as f:
            f.write(json.dumps(row) + "\n")


def drain_spool() -> int:
    """Try to flush spooled pings to Supabase. Keeps un-sendable lines for later."""
    if not os.path.exists(SPOOL):
        return 0
    with _spool_lock:
        try:
            lines = open(SPOOL, encoding="utf-8").read().splitlines()
        except FileNotFoundError:
            return 0
        remaining: list[str] = []
        drained = 0
        for ln in lines:
            if not ln.strip():
                continue
            if remaining:  # a send already failed this pass — keep the rest, retry later
                remaining.append(ln)
                continue
            try:
                get_client().table("bus_locations").insert(json.loads(ln)).execute()
                drained += 1
            except Exception:  # noqa: BLE001
                remaining.append(ln)
        with open(SPOOL, "w", encoding="utf-8") as f:
            f.write(("\n".join(remaining) + "\n") if remaining else "")
    if drained:
        logger.info("drained %d spooled ping(s)", drained)
    return drained
