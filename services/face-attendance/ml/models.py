"""
ml/models.py
────────────
Single shared, lazily-initialised instance of the detector + embedder, guarded by
a lock. Previously registration.py and recognition.py each held their own globals,
which double-loaded the ~250MB model pack and could race on first request.
"""

import threading
from typing import Optional

from ml.detector import FaceDetector
from ml.embedder import FaceEmbedder

_lock = threading.Lock()
_detector: Optional[FaceDetector] = None
_embedder: Optional[FaceEmbedder] = None


def get_models() -> tuple[FaceDetector, FaceEmbedder]:
    global _detector, _embedder
    if _detector is not None and _embedder is not None:
        return _detector, _embedder
    with _lock:
        if _detector is None:
            d = FaceDetector()
            d.initialise()
            _detector = d
        if _embedder is None:
            e = FaceEmbedder()
            e.initialise()
            _embedder = e
    return _detector, _embedder


def ready() -> bool:
    """True once both models are loaded (used by the /ready readiness probe)."""
    return _detector is not None and _embedder is not None
