"""Unit tests for the GPS store's pure helpers (no network)."""

import os

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "dummy")
os.environ.setdefault("SCHOOL_ID", "00000000-0000-0000-0000-000000000000")
os.environ.setdefault("DEVICE_API_KEY", "test-key")

from store import _build_row  # noqa: E402


def test_build_row_defaults_recorded_at():
    r = _build_row(route_id="route-1", latitude=28.6, longitude=77.2,
                   speed_kmh=None, heading=None, recorded_at=None)
    assert r["route_id"] == "route-1"
    assert r["latitude"] == 28.6 and r["longitude"] == 77.2
    assert r["recorded_at"]  # auto-filled with now()


def test_build_row_keeps_explicit_recorded_at():
    r = _build_row(route_id="r", latitude=1.0, longitude=2.0,
                   speed_kmh=25.0, heading=90.0, recorded_at="2026-01-01T00:00:00Z")
    assert r["recorded_at"] == "2026-01-01T00:00:00Z"
    assert r["speed_kmh"] == 25.0
