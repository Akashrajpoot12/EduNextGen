"""
ml/detector.py
──────────────
SCRFD face detector via insightface. (From the original face_attendance engine.)

  - Loads the SCRFD model once (from the buffalo_l model pack)
  - Accepts a raw BGR frame (numpy HxWx3)
  - Returns DetectedFace items with bbox, a 112x112 BGR crop (ready for ArcFace),
    and a detection confidence.

CPU note: runs comfortably ~10fps for a single camera. For GPU set DEVICE=cuda.
"""

from dataclasses import dataclass, field
from typing import Optional

import cv2
import numpy as np

from core.config import get_settings
from core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


@dataclass
class DetectedFace:
    bbox: tuple[int, int, int, int]   # x1, y1, x2, y2
    crop: np.ndarray                  # 112×112 BGR — ready for ArcFace
    conf: float

    # filled in by downstream stages
    track_id: Optional[int] = field(default=None)
    entity_id: Optional[str] = field(default=None)
    cosine_dist: Optional[float] = field(default=None)


class FaceDetector:
    """Thin wrapper around insightface FaceAnalysis (detection module only)."""

    def __init__(self):
        self._app = None
        self._initialised = False

    def initialise(self) -> None:
        """Call once at startup. Downloads the model pack on first run (~250MB)."""
        if self._initialised:
            return

        try:
            from insightface.app import FaceAnalysis
        except ImportError:
            raise RuntimeError("insightface not installed. Run: pip install insightface")

        models_dir = str(settings.models_dir)
        ctx_id = 0 if settings.use_gpu else -1   # -1 = CPU

        logger.info(
            "Loading SCRFD detector",
            extra={"model": settings.scrfd_model, "device": settings.device},
        )

        self._app = FaceAnalysis(
            name=settings.scrfd_model,
            root=models_dir,
            allowed_modules=["detection"],
            providers=(
                ["CUDAExecutionProvider", "CPUExecutionProvider"]
                if settings.use_gpu
                else ["CPUExecutionProvider"]
            ),
        )
        self._app.prepare(ctx_id=ctx_id, det_size=(640, 640))
        self._initialised = True
        logger.info("SCRFD detector ready")

    def detect(
        self,
        frame: np.ndarray,
        min_conf: Optional[float] = None,
    ) -> list[DetectedFace]:
        """Detect faces in a BGR frame. Returns list sorted by confidence desc."""
        if not self._initialised:
            raise RuntimeError("Call FaceDetector.initialise() first")

        threshold = min_conf if min_conf is not None else settings.detection_threshold
        faces = self._app.get(frame)

        results: list[DetectedFace] = []
        for face in faces:
            conf = float(face.det_score)
            if conf < threshold:
                continue

            x1, y1, x2, y2 = face.bbox.astype(int)
            h, w = frame.shape[:2]
            x1 = max(0, x1); y1 = max(0, y1)
            x2 = min(w, x2); y2 = min(h, y2)
            if x2 <= x1 or y2 <= y1:
                continue

            crop = _extract_crop(frame, x1, y1, x2, y2)
            results.append(DetectedFace(bbox=(x1, y1, x2, y2), crop=crop, conf=conf))

        results.sort(key=lambda f: f.conf, reverse=True)
        return results

    def shutdown(self) -> None:
        self._app = None
        self._initialised = False


def _extract_crop(
    frame: np.ndarray,
    x1: int, y1: int, x2: int, y2: int,
    target_size: int = 112,
) -> np.ndarray:
    """Crop + resize face region to 112×112 BGR (ArcFace input), with 10% padding."""
    h, w = frame.shape[:2]
    pad_x = int((x2 - x1) * 0.10)
    pad_y = int((y2 - y1) * 0.10)
    x1p = max(0, x1 - pad_x); y1p = max(0, y1 - pad_y)
    x2p = min(w, x2 + pad_x); y2p = min(h, y2 + pad_y)
    crop = frame[y1p:y2p, x1p:x2p]
    return cv2.resize(crop, (target_size, target_size), interpolation=cv2.INTER_LINEAR)
