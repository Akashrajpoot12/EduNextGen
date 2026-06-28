"""
store/supabase_store.py
───────────────────────
All data access for the face-attendance service goes through here.

It writes into the MAIN SMS Supabase project — the tables created by
supabase/migrations/00032_face_attendance_foundation.sql:
  - face_embeddings   (512-d ArcFace vectors, many rows per person)
  - daily_attendance  (students)
  - staff_attendance  (teachers / staff — both live in public.users)

Uses the service_role key, which BYPASSES RLS. Keep that key server-side only.
"""

import time
from datetime import datetime, timezone, timedelta
from typing import Callable, Optional

import numpy as np
from supabase import create_client, Client

from core.config import get_settings
from core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()

IST = timezone(timedelta(hours=5, minutes=30))

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client


def _retry(fn: Callable, attempts: int = 3, base_delay: float = 0.5):
    """Run a Supabase call with simple exponential-backoff retry on transient errors."""
    last_err = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 — network/transient errors bubble up here
            last_err = e
            if i < attempts - 1:
                time.sleep(base_delay * (2 ** i))
    raise last_err


def _vec(embedding: np.ndarray) -> str:
    """pgvector literal, e.g. '[0.12,-0.03,...]' — safe for inserts and RPC args."""
    arr = np.asarray(embedding, dtype=np.float64).ravel()
    if arr.shape[0] != 512:
        raise ValueError(f"embedding must be 512-d, got {arr.shape[0]}")
    if not np.all(np.isfinite(arr)):
        raise ValueError("embedding contains NaN/Inf — refusing to store")
    return "[" + ",".join(f"{x:.8f}" for x in arr) + "]"


def _col(entity_type: str) -> str:
    return "student_id" if entity_type == "student" else "user_id"


# ── Embeddings ───────────────────────────────────────────────────────────────

def store_embedding(embedding: np.ndarray, *, entity_type: str, entity_id: str,
                    image_label: Optional[str] = None) -> None:
    if entity_type not in ("student", "staff"):
        raise ValueError("entity_type must be 'student' or 'staff'")
    row = {
        "school_id": settings.school_id,
        "embedding": _vec(embedding),
        "image_label": image_label,
        _col(entity_type): entity_id,
    }
    _retry(lambda: get_client().table("face_embeddings").insert(row).execute())


def count_embeddings(entity_type: str, entity_id: str) -> int:
    res = (
        get_client().table("face_embeddings")
        .select("id", count="exact")
        .eq(_col(entity_type), entity_id)
        .execute()
    )
    return res.count or 0


def delete_embeddings(entity_type: str, entity_id: str) -> None:
    get_client().table("face_embeddings").delete().eq(_col(entity_type), entity_id).execute()


def match_face(embedding: np.ndarray) -> Optional[dict]:
    """
    Return the best match for this embedding within the configured school, or None.
    Shape: {entity_type, entity_id, full_name, similarity}
    """
    res = _retry(lambda: get_client().rpc(
        "match_face_embedding",
        {
            "query_embedding": _vec(embedding),
            "match_threshold": settings.match_similarity_threshold,
            "match_count": settings.top_k_search,
            "p_school_id": settings.school_id,
        },
    ).execute())
    rows = res.data or []
    return rows[0] if rows else None


# ── Attendance ───────────────────────────────────────────────────────────────

def mark_attendance(*, entity_type: str, entity_id: str, confidence: float,
                    status: Optional[str] = None,
                    when: Optional[datetime] = None) -> bool:
    """
    Mark today's attendance. Returns True if a NEW row was created, False if the
    person was already marked today (per-day dedup).
    """
    if entity_type not in ("student", "staff"):
        raise ValueError("entity_type must be 'student' or 'staff'")
    when = when or datetime.now(IST)
    today = when.date().isoformat()
    status = status or settings.default_status
    client = get_client()

    table = "daily_attendance" if entity_type == "student" else "staff_attendance"
    id_col = _col(entity_type)
    # Idempotent: rely on the DB unique constraint (daily_attendance: student_id,date;
    # staff_attendance: school_id,user_id,date) instead of a racy select-then-insert.
    conflict = "student_id,date" if entity_type == "student" else "school_id,user_id,date"

    res = _retry(lambda: client.table(table).upsert({
        "school_id": settings.school_id,
        id_col: entity_id,
        "date": today,
        "status": status,
        "method": "face_ai",
        "confidence": round(float(confidence), 4),
        "check_in_at": when.isoformat(),
    }, on_conflict=conflict, ignore_duplicates=True).execute())
    # ignore_duplicates → empty data means the person was already marked today.
    return bool(res.data)
