"""
core/config.py — GPS tracking service configuration.

Writes bus coordinates into the MAIN SMS Supabase project (table bus_locations,
created by migration 00033_bus_locations.sql). No DB of its own.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    # ── Supabase (shared SMS database) ───────────────────────────
    supabase_url: str
    supabase_service_key: str          # service_role — SERVER SIDE ONLY
    school_id: str                     # schools.id these buses belong to

    # ── Device auth ──────────────────────────────────────────────
    # Bus devices / driver apps must send this in the X-Device-Key header.
    device_api_key: str = "CHANGE_ME"

    # ── Durability ───────────────────────────────────────────────
    # If Supabase is unreachable, pings are appended here and drained later so no
    # location data is lost.
    spool_path: str = "gps_spool.jsonl"

    # ── API ──────────────────────────────────────────────────────
    api_host: str = "0.0.0.0"
    api_port: int = 8100
    log_level: str = "INFO"
    log_format: str = "plain"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
