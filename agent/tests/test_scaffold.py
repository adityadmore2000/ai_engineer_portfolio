from __future__ import annotations

from pathlib import Path


def test_harness_runs(fixture_path: Path, read_fixture):
    """Phase 1 smoke test: proves pytest + the fixture harness resolve."""
    assert fixture_path.is_dir()
    assert read_fixture("valid-spec.md").startswith("---")
    expected = {
        "valid-spec.md",
        "missing-frontmatter.md",
        "malformed-frontmatter.md",
        "missing-required-meta.md",
        "duplicate-section-id.md",
        "empty-body.md",
        "unknown-section.md",
        "rich-body.md",
        "metadata-carrying.md",
    }
    present = {p.name for p in fixture_path.glob("*") if p.is_file()}
    assert expected <= present


def test_specs_package_imports() -> None:
    """The empty `agent/specs` package must import cleanly."""
    import specs

    assert specs.__file__.endswith("specs/__init__.py")