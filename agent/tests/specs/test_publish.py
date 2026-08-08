from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

import bridges
import spec_pipeline

# ── Mock discovered schema ────────────────────────────────────────
#
# A hermetic stand-in for `sanity/schemaTypes/project.ts` (mirrors the writable
# field set). `get_discovered_schema` is monkeypatched so the publish tests
# stay fast and deterministic — no `describe-schema.ts` subprocess.

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
        {"name": "keyMetrics", "type": "array", "of": [{"type": "string"}]},
        {"name": "coverImage", "type": "image"},
        {"name": "featured", "type": "boolean"},
        {"name": "displayOrder", "type": "number", "constraints": {"integer": True, "min": 0}},
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
    monkeypatch.setattr(spec_pipeline, "get_discovered_schema", lambda: MOCK_SCHEMA)


def make_fake_create():
    """A `create_project_fn`-contract fake (accepts {"project_data": dict})."""
    calls: list[dict] = []

    def fake_create(args: dict) -> str:
        calls.append(args)
        return f"Created {args['project_data'].get('title')}"

    return fake_create, calls


def read_audit(out: str) -> dict:
    lines = [l for l in out.splitlines() if l.startswith("Audit log: ")]
    assert lines, f"expected an audit line in output:\n{out}"
    path = Path(lines[0].split("Audit log: ", 1)[1])
    record = json.loads(path.read_text(encoding="utf-8"))
    path.unlink()  # tests must not pollute .agents
    return record


# ── confirm_pending_create publishes content for canonical specs ──


def test_confirm_canonical_publishes_content_and_audits(
    monkeypatch, mock_schema, fixture_path
):
    spec_pipeline.create_project_from_spec(str(fixture_path / "valid-spec.md"))

    bridge_calls: list[dict] = []

    def fake_bridge(mode, spec_path, json_path, slug=None):
        data = json.loads(Path(json_path).read_text(encoding="utf-8"))
        bridge_calls.append(
            {"mode": mode, "spec_path": spec_path, "slug": slug, "data": data}
        )
        return bridges.BridgeResult(success=True, stdout="content patched (3 blocks)", stderr="")

    monkeypatch.setattr(spec_pipeline.bridges, "publish_project_spec", fake_bridge)
    fake_create, create_calls = make_fake_create()

    out = spec_pipeline.confirm_pending_create(fake_create)

    # Metadata write happens exactly once, through the injected create fn.
    assert len(create_calls) == 1
    assert create_calls[0]["project_data"]["slug"] == "candidate-ranking-system"

    # Content is published through the bridge in the same confirmation turn.
    assert not spec_pipeline._pending_create.is_pending
    assert len(bridge_calls) == 1
    call = bridge_calls[0]
    assert call["mode"] == "update"  # metadata already created above
    assert call["slug"] == "candidate-ranking-system"
    assert call["data"]["title"] == "Candidate Ranking System"
    assert call["data"]["published"] is True
    assert call["data"]["__markdownDir__"] == str(fixture_path)
    assert "content patched (3 blocks)" in out

    # Audit now carries section_ids + body_sha256.
    record = read_audit(out)
    assert record["format"] == "frontmatter"
    assert record["section_ids"] == ["overview", "architecture", "results"]
    assert record["body_sha256"]


def test_confirm_legacy_skips_content_publish(monkeypatch, mock_schema, fixture_path):
    spec_pipeline.create_project_from_spec(str(fixture_path / "legacy-bullets.spec.md"))

    bridge_calls: list = []

    def fake_bridge(*args, **kwargs):
        bridge_calls.append((args, kwargs))
        return bridges.BridgeResult(success=True, stdout="unexpected", stderr="")

    monkeypatch.setattr(spec_pipeline.bridges, "publish_project_spec", fake_bridge)
    fake_create, create_calls = make_fake_create()

    out = spec_pipeline.confirm_pending_create(fake_create)

    assert create_calls, "the metadata create must still run for legacy specs"
    assert bridge_calls == [], "legacy records never touch the content bridge"
    assert "Content:" not in out

    record = read_audit(out)
    assert record["format"] == "legacy"
    assert record["section_ids"] == []
    assert record["body_sha256"] is None


def test_confirm_canonical_empty_body_skips_content_publish(
    monkeypatch, mock_schema, fixture_path
):
    spec_pipeline.create_project_from_spec(str(fixture_path / "empty-body.md"))

    bridge_calls: list = []

    def fake_bridge(*args, **kwargs):
        bridge_calls.append((args, kwargs))
        return bridges.BridgeResult(success=True, stdout="unexpected", stderr="")

    monkeypatch.setattr(spec_pipeline.bridges, "publish_project_spec", fake_bridge)
    fake_create, create_calls = make_fake_create()

    out = spec_pipeline.confirm_pending_create(fake_create)

    assert create_calls, "metadata create still happens for empty-body specs"
    assert bridge_calls == [], "empty-body rule: no content publish call"
    record = read_audit(out)
    assert record["format"] == "frontmatter"
    assert record["section_ids"] == []
    assert record["body_sha256"] == hashlib.sha256(b"").hexdigest()


# ── publish_project_spec orchestrator ────────────────────────────


def test_publish_project_spec_canonical_create(monkeypatch, mock_schema, fixture_path):
    captured: list[tuple] = []

    def fake_bridge(mode, spec_path, json_path, slug=None):
        data = json.loads(Path(json_path).read_text(encoding="utf-8"))
        captured.append((mode, spec_path, slug, data))
        return bridges.BridgeResult(success=True, stdout="Created and content replaced (3 blocks).", stderr="")

    monkeypatch.setattr(spec_pipeline.bridges, "publish_project_spec", fake_bridge)

    out = spec_pipeline.publish_project_spec(str(fixture_path / "valid-spec.md"), "create")

    assert "Created and content replaced" in out
    assert len(captured) == 1
    mode, spec_path, slug, data = captured[0]
    assert mode == "create"
    assert slug is None
    assert spec_path == str(fixture_path / "valid-spec.md")
    assert data["slug"] == "candidate-ranking-system"
    assert data["published"] is True
    assert data["__markdownDir__"] == str(fixture_path)


def test_publish_project_spec_update_passes_slug(monkeypatch, mock_schema, fixture_path):
    captured: list[tuple] = []

    def fake_bridge(mode, spec_path, json_path, slug=None):
        data = json.loads(Path(json_path).read_text(encoding="utf-8"))
        captured.append((mode, spec_path, slug, data))
        return bridges.BridgeResult(success=True, stdout="Updated and content replaced.", stderr="")

    monkeypatch.setattr(spec_pipeline.bridges, "publish_project_spec", fake_bridge)

    out = spec_pipeline.publish_project_spec(str(fixture_path / "valid-spec.md"), "update")

    assert "Updated and content replaced" in out
    assert captured[0][0] == "update"
    assert captured[0][2] == "candidate-ranking-system"


def test_publish_project_spec_invalid_mode(mock_schema, fixture_path):
    out = spec_pipeline.publish_project_spec(str(fixture_path / "valid-spec.md"), "upsert")
    assert out.startswith("Error")
    assert "upsert" in out


def test_publish_project_spec_bridge_failure(monkeypatch, mock_schema, fixture_path):
    def fake_bridge(*args, **kwargs):
        return bridges.BridgeResult(success=False, stdout="", stderr="SANITY_API_WRITE_TOKEN missing")

    monkeypatch.setattr(spec_pipeline.bridges, "publish_project_spec", fake_bridge)

    out = spec_pipeline.publish_project_spec(str(fixture_path / "valid-spec.md"), "create")

    assert "Error publishing project spec" in out
    assert "SANITY_API_WRITE_TOKEN" in out