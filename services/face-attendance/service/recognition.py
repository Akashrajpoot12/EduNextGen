"""
service/recognition.py
──────────────────────
Given a camera frame: detect faces → embed → match against Supabase →
mark attendance (with per-day dedup).
"""

from typing import Optional

import numpy as np

from core.config import get_settings
from core.logging import get_logger
from ml.models import get_models as _models
from store import supabase_store

logger = get_logger(__name__)
settings = get_settings()


def recognise_frame(frame: np.ndarray, *, mark: bool = True) -> list[dict]:
    """
    Returns one event per detected face:
      matched=False → {matched, bbox, det_conf}
      matched=True  → {matched, entity_type, entity_id, name, similarity,
                       newly_marked, bbox}
    """
    detector, embedder = _models()
    faces = detector.detect(frame)

    events: list[dict] = []
    for face in faces:
        embedding = embedder.generate(face.crop)
        match = supabase_store.match_face(embedding)

        if not match:
            events.append({
                "matched": False,
                "bbox": face.bbox,
                "det_conf": round(face.conf, 3),
            })
            continue

        entity_type = match["entity_type"]
        entity_id = match["entity_id"]
        similarity = float(match["similarity"])
        name = match.get("full_name")

        newly_marked = False
        if mark:
            newly_marked = supabase_store.mark_attendance(
                entity_type=entity_type, entity_id=entity_id, confidence=similarity
            )

        events.append({
            "matched": True,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "name": name,
            "similarity": round(similarity, 4),
            "newly_marked": newly_marked,
            "bbox": face.bbox,
        })
    return events
