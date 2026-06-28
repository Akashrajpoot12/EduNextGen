"""Unit tests for the pure parts of the Supabase data layer (no network)."""

import os

import numpy as np
import pytest

# Settings load at import time — provide dummy values so the module imports.
os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "dummy")
os.environ.setdefault("SCHOOL_ID", "00000000-0000-0000-0000-000000000000")

from store.supabase_store import _vec, _col  # noqa: E402


def test_vec_valid_512():
    out = _vec(np.ones(512, dtype=np.float32))
    assert out.startswith("[") and out.endswith("]")
    assert out.count(",") == 511


def test_vec_rejects_wrong_dim():
    with pytest.raises(ValueError):
        _vec(np.ones(128, dtype=np.float32))


def test_vec_rejects_nan():
    a = np.ones(512, dtype=np.float32)
    a[0] = np.nan
    with pytest.raises(ValueError):
        _vec(a)


def test_col_routing():
    assert _col("student") == "student_id"
    assert _col("staff") == "user_id"
