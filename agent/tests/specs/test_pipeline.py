from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path

import pytest

import spec_pipeline


# ── Mock discovered schema ────────────────────────────────────────
#
# Mirrors the writable field set of `sanity/schemaTypes/project.ts` (string,
# markdown, url, number, boolean scalars plus string/image arrays). The
# monkeypatched `get_discovered_schema` replaces the `describe-schema.ts`
# subprocess so the pipeline tests stay fast and deterministic.

MOCK_SCHEMA = {
    "name": "project",
    "type": "document",
    "title": "Projects",
    "fields": [
        {"name": "title", "type": "string", "constraints": {"required": True}, "required": True},
        {"name": "slug", "type": "slug", "constraints": {"required": True}, "required": True},
        {"name": "shortSummary", "type": "markdown"},
        {"name": "status", "type": "string"},
        {"name": "technologies", "type": "array", "of": [{"type": "string"}]},
        {"name": "githubUrl", "type": "url", "constraints": {"uri": {"scheme": ["http", "https", "mailto"]}}},
        {"name": "demoUrl", "type": "url", "constraints": {"uri": {"scheme": ["http", "https", "mailto"]}}},
        {"name": "demoVideo", "type": "url", "constraints": {"uri": {"scheme": ["http", "https", "mailto"]}}},
        {"name": "keyMetrics", "type": "array", "of": [{"type": "string"}]},
        {"name": "coverImage", "type": "image"},
        {"name": "featured", "type": "boolean", "initialValue": True},
        {"name": "displayOrder", "type": "number", "constraints": {"integer": True, "min": 0}},
        {"name": "screenshots", "type": "array", "of": [{"type": "image"}]},
        {"name": "content", "type": "array", "of": [{"type": "block"}], "constraints": {"min": 1}},
        {"name": "published", "type": "boolean"},
    ],
}


@pytest.fixture(autouse=True)
def _clear_pending() -> None:
    spec_pipeline._pending_create.clear()
    yield
    spec_pipeline._pending_create.clear()


@pytest.fixture
def mock_schema(monkeypatch) -> None:
    """Point `get_discovered_schema` at the hermetic fixture schema."""
    monkeypatch.setattr(
        spec_pipeline,
        "get_discovered_schema",
        lambda: copy.deepcopy(MOCK_SCHEMA),
    )


# ── Canonical format ──────────────────────────────────────────────


def test_canonical_valid_spec_stages_expected_payload(mock_schema, fixture_path: Path):
    result = spec_pipeline.create_project_from_spec(str(fixture_path / "valid-spec.md"))
    parsed = json.loads(result)
    assert parsed["status"] == "pending_confirmation"
    assert parsed["format"] == "frontmatter"

    pending = spec_pipeline._pending_create.get()
    assert pending["format"] == "frontmatter"

    payload = pending["payload"]
    assert payload["title"] == "Candidate Ranking System"
    assert payload["slug"] == "candidate-ranking-system"
    assert payload["status"] == "completed"
    assert payload["shortSummary"] == (
        "Rank 100K+ candidate profiles against a job description into a shortlist CSV."
    )
    assert payload["technologies"] == ["Python 3.10", "PyTorch"]
    assert payload["keyMetrics"] == ["Ranked 100K+ profiles in minutes"]
    assert payload["githubUrl"] == "https://github.com/theule-home/candidate-ranking"
    assert payload["coverImage"] == "/images/cover.png"
    assert payload["coverImageAlt"] == "Pipeline overview"
    assert payload["featured"] is True
    assert payload["displayOrder"] == 0
    assert payload["published"] is True
    assert payload["__markdownDir__"] == str(fixture_path)

    assert [s["id"] for s in pending["sections"]] == ["overview", "architecture", "results"]
    assert [s["order"] for s in pending["sections"]] == [1, 2, 3]
    assert [s["line"] for s in pending["sections"]] == [1, 5, 14]
    assert [s["depth"] for s in pending["sections"]] == [2, 2, 2]
    assert pending["sections"][0]["body_md"].strip() == (
        "The problem it solves: ranking hundreds of thousands of candidate profiles."
    )
    assert pending["body_md"]
    assert pending["body_sha256"]
    assert pending["provenance"] == {}


def test_canonical_empty_body_stages_without_sections(mock_schema, fixture_path: Path):
    result = spec_pipeline.create_project_from_spec(str(fixture_path / "empty-body.md"))
    json.loads(result)
    pending = spec_pipeline._pending_create.get()
    assert pending["format"] == "frontmatter"
    assert pending["body_md"] == ""
    assert pending["sections"] == []
    assert pending["body_sha256"] == hashlib.sha256(b"").hexdigest()
    assert pending["payload"]["title"] == "Empty Body Project"


def test_canonical_metadata_carrying_coerces_types(mock_schema, fixture_path: Path):
    result = spec_pipeline.create_project_from_spec(str(fixture_path / "metadata-carrying.md"))
    json.loads(result)
    payload = spec_pipeline._pending_create.get()["payload"]
    assert payload["status"] == "poc"
    assert payload["featured"] is False
    assert payload["displayOrder"] == 3
    assert payload["technologies"] == ["Rust", "WebGPU", "TypeScript"]
    assert payload["keyMetrics"] == ["First paint in 140 ms", "0 layout shifts"]
    assert payload["githubUrl"] == "https://github.com/theule-home/metadata-carrying"
    assert payload["demoUrl"] == "https://example.com/demo"
    assert payload["demoVideo"] == "https://example.com/watch.mp4"
    assert payload["screenshots"] == ["/images/shot-1.png", "/images/shot-2.png"]
    assert payload["screenshotAlts"] == ["Dark theme dashboard", "Light theme dashboard"]


def test_canonical_missing_required_meta_errors(mock_schema, fixture_path: Path):
    result = spec_pipeline.create_project_from_spec(str(fixture_path / "missing-required-meta.md"))
    assert isinstance(result, str) and result.startswith("Error")
    assert "title" in result and "slug" in result
    assert not spec_pipeline._pending_create.is_pending


def test_canonical_duplicate_section_id_errors(mock_schema, fixture_path: Path):
    result = spec_pipeline.create_project_from_spec(str(fixture_path / "duplicate-section-id.md"))
    assert isinstance(result, str) and result.startswith("Error")
    assert "shared" in result
    assert not spec_pipeline._pending_create.is_pending


def test_malformed_frontmatter_errors(fixture_path: Path):
    result = spec_pipeline.create_project_from_spec(str(fixture_path / "malformed-frontmatter.md"))
    assert isinstance(result, str) and result.startswith("Error")
    assert "YAML" in result or "front" in result
    assert not spec_pipeline._pending_create.is_pending


def test_unknown_frontmatter_key_collected_as_warning(fixture_path: Path, tmp_path: Path):
    spec_path = tmp_path / "unknown-key.md"
    spec_path.write_text(
        "---\n"
        "schema_version: 1\n"
        "type: project\n"
        "title: Unknown Key\n"
        "slug: unknown-key\n"
        "titel: typo\n"  # unknown field -> warning, never a hard failure
        "---\n"
        "\n"
        "## Overview {#overview}\n"
        "\n"
        "Prose.\n",
        encoding="utf-8",
    )
    parsed = json.loads(spec_pipeline.parse_spec_file(str(spec_path)))
    assert parsed["format"] == "frontmatter"
    assert any("titel" in w for w in parsed["warnings"])
    assert "titel" not in parsed["fields"]


# ── Legacy adapter (transitional) ────────────────────────────────


def test_legacy_bullet_fields_and_provenance_regression(fixture_path: Path):
    """The legacy adapter must keep producing the exact old fields/provenance."""
    parsed = json.loads(spec_pipeline.parse_spec_file(str(fixture_path / "legacy-bullets.spec.md")))
    assert parsed["format"] == "legacy"
    assert parsed["fields"] == {
        "title": "Video Captioning Agent",
        "slug": "video-captioning-agent",
        "shortSummary": "A hackathon project that watches videos and produces captions.",
        "technologies": ["Python", "OpenCV", "Docker"],
        "keyMetrics": ["27 commits covering every major pipeline stage"],
        "githubUrl": "https://github.com/theule-home/video-captioning",
        "featured": "true",
        "displayOrder": "0",
    }
    assert parsed["provenance"] == {
        "title": 1,
        "slug": 2,
        "shortSummary": 3,
        "technologies": 5,
        "keyMetrics": 9,
        "githubUrl": 11,
        "featured": 13,
        "displayOrder": 14,
    }
    assert parsed["body_md"] == ""
    assert parsed["sections"] == []


def test_legacy_bullet_stages_payload_with_legacy_format(mock_schema, fixture_path: Path):
    result = spec_pipeline.create_project_from_spec(str(fixture_path / "legacy-bullets.spec.md"))
    parsed = json.loads(result)
    assert parsed["format"] == "legacy"
    pending = spec_pipeline._pending_create.get()
    assert pending["format"] == "legacy"
    assert pending["body_md"] == ""
    assert pending["body_sha256"] is None
    payload = pending["payload"]
    assert payload["title"] == "Video Captioning Agent"
    assert payload["slug"] == "video-captioning-agent"
    assert payload["technologies"] == ["Python", "OpenCV", "Docker"]
    assert payload["featured"] is True
    assert payload["displayOrder"] == 0
    assert payload["published"] is True


def test_missing_frontmatter_routes_to_legacy_adapter(fixture_path: Path):
    parsed = json.loads(
        spec_pipeline.parse_spec_file(str(fixture_path / "missing-frontmatter.md"))
    )
    assert parsed["format"] == "legacy"
    assert parsed["fields"]["title"] == "Legacy bullet title"
    assert parsed["fields"]["slug"] == "legacy-bullet-slug"


# ── LLM repair boundary ──────────────────────────────────────────


def test_body_never_reaches_llm_repair(monkeypatch, mock_schema, tmp_path):
    """An invalid metadata value triggers repair; the Markdown body does not leak."""
    spec_path = tmp_path / "repair-target.md"
    spec_path.write_text(
        "---\n"
        "schema_version: 1\n"
        "type: project\n"
        "title: Repair Target\n"
        "slug: repair-target\n"
        "githubUrl: not-a-url\n"
        "---\n"
        "\n"
        "## Overview {#overview}\n"
        "\n"
        "This body text must never reach the LLM call.\n",
        encoding="utf-8",
    )

    repairs: list = []

    def fake_repair(parsed_fields, schema, errors):
        repairs.append(parsed_fields)
        return dict(parsed_fields), []

    monkeypatch.setattr(spec_pipeline, "_llm_repair", fake_repair)
    result = spec_pipeline.create_project_from_spec(str(spec_path))
    assert json.loads(result)["status"] == "pending_confirmation"

    assert repairs, "_llm_repair should have been triggered"
    reparsed = json.dumps(repairs[0], default=str)
    assert "body_md" not in reparsed
    assert "This body text must never reach the LLM call." not in reparsed
    assert "not-a-url" in reparsed