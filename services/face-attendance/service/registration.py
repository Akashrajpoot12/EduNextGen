"""
service/registration.py
────────────────────────
Enroll a person (student OR staff/teacher) by turning several photos into
ArcFace embeddings stored in Supabase.

Best accuracy comes from 10-15+ photos at DIFFERENT angles / lighting /
expression — each photo becomes its own embedding row.
"""

from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from core.config import get_settings
from core.logging import get_logger
from ml.models import get_models as _models
from store import supabase_store

logger = get_logger(__name__)
settings = get_settings()


def register_frames(*, entity_type: str, entity_id: str,
                    frames: list[np.ndarray],
                    labels: Optional[list[str]] = None,
                    overwrite: bool = False) -> dict:
    if entity_type not in ("student", "staff"):
        raise ValueError("entity_type must be 'student' or 'staff'")

    detector, embedder = _models()
    if overwrite:
        supabase_store.delete_embeddings(entity_type, entity_id)

    result = {"processed": 0, "stored": 0, "skipped": 0}
    for idx, frame in enumerate(frames):
        result["processed"] += 1
        label = labels[idx] if labels and idx < len(labels) else f"frame_{idx:03d}"

        faces = detector.detect(frame, min_conf=0.4)
        if not faces:
            result["skipped"] += 1
            logger.warning("No face detected in a photo", extra={"label": label})
            continue

        # highest-confidence face (detect() returns sorted desc)
        embedding = embedder.generate(faces[0].crop)
        supabase_store.store_embedding(
            embedding, entity_type=entity_type, entity_id=entity_id, image_label=label
        )
        result["stored"] += 1

    result["total_on_record"] = supabase_store.count_embeddings(entity_type, entity_id)
    logger.info("Enrollment complete",
                extra={"entity_type": entity_type, "entity_id": entity_id, **result})
    return result


def register_images(*, entity_type: str, entity_id: str,
                    image_paths: list, overwrite: bool = False) -> dict:
    frames: list[np.ndarray] = []
    labels: list[str] = []
    for p in image_paths:
        p = Path(p)
        img = cv2.imread(str(p))
        if img is None:
            logger.warning(f"Could not read image: {p}")
            continue
        frames.append(img)
        labels.append(p.stem)
    return register_frames(entity_type=entity_type, entity_id=entity_id,
                           frames=frames, labels=labels, overwrite=overwrite)
