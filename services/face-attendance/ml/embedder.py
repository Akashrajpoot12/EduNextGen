"""
ml/embedder.py
──────────────
ArcFace face embedding engine (insightface recognition model, w600k_r50).
(From the original face_attendance engine — DB matching removed; matching now
 happens in Supabase via the match_face_embedding RPC.)

generate(crop) → 512-d float32 numpy vector (L2-normalised)

CPU note: ArcFace runs ~15-20ms per face on a modern CPU.
"""

import numpy as np

from core.config import get_settings
from core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


class FaceEmbedder:
    """
    Wraps insightface's ArcFace recognition model.
    Input: 112×112 BGR crop (from FaceDetector). Output: L2-normalised 512-d vector.
    """

    def __init__(self):
        self._model = None
        self._initialised = False

    def initialise(self) -> None:
        if self._initialised:
            return

        try:
            import insightface  # noqa: F401
        except ImportError:
            raise RuntimeError("insightface not installed. Run: pip install insightface")

        from pathlib import Path
        import insightface

        # insightface stores models under root/models/<name>/
        models_dir = settings.models_dir / "models" / settings.scrfd_model
        recog_path = models_dir / "w600k_r50.onnx"

        if not recog_path.exists():
            recog_path = settings.models_dir / settings.scrfd_model / "w600k_r50.onnx"
        if not recog_path.exists():
            home = Path.home() / ".insightface" / "models" / settings.scrfd_model
            recog_path = home / "w600k_r50.onnx"
        if not recog_path.exists():
            raise RuntimeError(
                f"ArcFace model not found at {recog_path}\n"
                "Run the detector once first to download the buffalo_l model pack."
            )

        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if settings.use_gpu
            else ["CPUExecutionProvider"]
        )

        self._model = insightface.model_zoo.get_model(str(recog_path), providers=providers)
        self._model.prepare(ctx_id=0 if settings.use_gpu else -1)
        self._initialised = True
        logger.info(
            "ArcFace embedder ready",
            extra={"model_path": str(recog_path), "device": settings.device},
        )

    def generate(self, crop: np.ndarray) -> np.ndarray:
        """Generate a 512-d L2-normalised embedding from a 112×112 BGR crop."""
        if not self._initialised:
            raise RuntimeError("Call FaceEmbedder.initialise() first")
        if crop.shape != (112, 112, 3):
            raise ValueError(f"ArcFace expects 112×112×3 BGR crop, got {crop.shape}")

        embedding = self._model.get_feat(crop)
        if embedding.ndim == 2:
            embedding = embedding[0]

        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        return embedding.astype(np.float32)

    def shutdown(self) -> None:
        self._model = None
        self._initialised = False
