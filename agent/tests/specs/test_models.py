from __future__ import annotations

import pytest
from pydantic import ValidationError

from specs.models import (
    RECOMMENDED_IDS,
    SCHEMA_VERSION,
    MarkdownSection,
    ProjectMetadata,
    ProjectSpec,
)

BASE = {
    "schema_version": 1,
    "type": "project",
    "title": "Candidate Ranking System",
    "slug": "candidate-ranking-system",
    "status": "completed",
    "shortSummary": "Ranked 100K+ profiles against a job description into a shortlist CSV.",
    "technologies": ["Python 3.10", "PyTorch"],
    "keyMetrics": ["Ranked 100K+ profiles in minutes"],
    "githubUrl": "https://github.com/theule-home/candidate-ranking",
    "featured": True,
    "displayOrder": 0,
}


def meta(**overrides) -> ProjectMetadata:
    data = dict(BASE)
    data.update(overrides)
    return ProjectMetadata(**data)


def test_project_metadata_from_valid_data() -> None:
    m = meta()
    assert m.title == "Candidate Ranking System"
    assert m.slug == "candidate-ranking-system"
    assert m.status == "completed"
    assert m.technologies == ["Python 3.10", "PyTorch"]
    assert m.featured is True
    assert m.displayOrder == 0


def test_slug_rejects_uppercase():
    with pytest.raises(ValidationError):
        meta(slug="UPPERCASE-SLUG")


def test_slug_rejects_leading_hyphen():
    with pytest.raises(ValidationError):
        meta(slug="-bad")


def test_slug_rejects_trailing_hyphen():
    with pytest.raises(ValidationError):
        meta(slug="bad-")


def test_title_required():
    with pytest.raises(ValidationError):
        meta(title="")


def test_status_enum_rejects_unknown():
    with pytest.raises(ValidationError):
        meta(status="not-a-status")


def test_optional_defaults_are_none():
    m = ProjectMetadata(title="T", slug="t")
    assert m.shortSummary is None
    assert m.demoUrl is None
    assert m.demoVideo is None
    assert m.coverImage is None
    assert m.coverImageAlt is None
    assert m.featured is None
    assert m.displayOrder is None


def test_shallow_defaults_empty():
    m = ProjectMetadata(title="T", slug="t")
    assert m.technologies == []
    assert m.keyMetrics == []
    assert m.screenshots == []
    assert m.screenshotAlts == []


def test_extra_key_collected_in_model_extra():
    m = meta(unknownKey="oops")
    assert m.model_extra == {"unknownKey": "oops"}


def test_display_order_rejects_negative():
    with pytest.raises(ValidationError):
        meta(displayOrder=-1)


def test_display_order_accepts_zero_and_positive():
    assert meta(displayOrder=0).displayOrder == 0
    assert meta(displayOrder=5).displayOrder == 5


def test_project_spec_instantiation_and_section_id_helper():
    spec = ProjectSpec(
        source_path="/repo/projects/x/project-spec.md",
        source_dir="/repo/projects/x",
        raw_sha256="abc123",
        raw_length=123,
        format="frontmatter",
        metadata=meta(),
        body_md="## Overview\n\nProse.",
        sections=[
            MarkdownSection(
                id="overview", heading="Overview", depth=2, order=1, line=6, body_md="Prose."
            )
        ],
        unknown_meta=[("bogus", 1)],
        warnings=["unknown front-matter key: bogus"],
    )
    assert spec.format == "frontmatter"
    assert spec.section_id("overview") is spec.sections[0]
    assert spec.section_id("missing") is None


def test_constants_present():
    assert SCHEMA_VERSION == 1
    assert "overview" in RECOMMENDED_IDS
    assert "future-improvements" in RECOMMENDED_IDS