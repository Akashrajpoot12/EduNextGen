"""
core/config.py
──────────────
Runtime configuration for the face-attendance service (Phase 1, Supabase-native).

All values come from environment variables / a local .env file.
This service writes into the MAIN SMS Supabase project — it has no DB of its own.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Supabase (the shared SMS database) ───────────────────────
    supabase_url: str
    supabase_service_key: str          # service_role key — SERVER SIDE ONLY
    school_id: str                     # schools.id this camera/kiosk belongs to

    # ── ML models ────────────────────────────────────────────────
    models_dir: Path = Path("./models_cache")
    device: str = "cpu"                # "cpu" | "cuda"
    scrfd_model: str = "buffalo_l"
    detection_threshold: float = 0.5
    recognition_threshold: float = 0.35   # used only for the 0-1 confidence calc

    # ── Matching ─────────────────────────────────────────────────
    # Cosine similarity (0..1). Higher = stricter (fewer false matches).
    match_similarity_threshold: float = 0.5
    top_k_search: int = 1

    # ── Enrollment ───────────────────────────────────────────────
    max_enrollment_images: int = 30

    # ── Attendance behaviour ─────────────────────────────────────
    attendance_dedup_minutes: int = 5
    default_status: str = "present"

    # ── Camera (for the webcam helper scripts) ───────────────────
    camera_source: str = "0"           # "0" = default webcam, or an RTSP URL

    # ── API ──────────────────────────────────────────────────────
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    # Shared secret required in the X-Service-Key header on /register & /recognize.
    # If empty the endpoints are UNAUTHENTICATED (dev only) and a warning is logged.
    service_api_key: str = ""
    # Comma-separated browser origins allowed to call this service.
    # Default is the local dev web app; set to your real web origin in prod.
    cors_allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    # ── Logging ──────────────────────────────────────────────────
    log_level: str = "INFO"
    log_format: str = "plain"          # "json" | "plain"

    # ── Derived ──────────────────────────────────────────────────
    @property
    def use_gpu(self) -> bool:
        return self.device.lower() == "cuda"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()] or ["*"]

    @property
    def camera_source_resolved(self):
        try:
            return int(self.camera_source)
        except ValueError:
            return self.camera_source

    @model_validator(mode="after")
    def _ensure_dirs(self) -> "Settings":
        self.models_dir.mkdir(parents=True, exist_ok=True)
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
