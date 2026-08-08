from __future__ import annotations

from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture
def fixture_path() -> Path:
    """Absolute path to the shared canonical-format fixtures directory."""
    return FIXTURES_DIR


@pytest.fixture
def read_fixture(fixture_path: Path):
    """Read a fixture file's UTF-8 content by name."""

    def _read(name: str) -> str:
        return (fixture_path / name).read_text(encoding="utf-8")

    return _read