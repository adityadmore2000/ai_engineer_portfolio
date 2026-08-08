from __future__ import annotations

import pytest

from specs.extract import SectionError, extract_sections
from specs.frontmatter import strip_frontmatter
from specs.ids import generate_heading_id

SRC = "test-spec.md"


def test_ordered_sections_with_ids_and_verbatim_bodies():
    body = (
        "## Why {#overview}\n"
        "\n"
        "Some prose.\n"
        "\n"
        "## Architecture {#architecture}\n"
        "\n"
        "```mermaid\n"
        "graph TD\n"
        "  A --> B\n"
        "```\n"
    )
    sections, warnings = extract_sections(body, SRC)
    assert warnings == []
    assert [s.id for s in sections] == ["overview", "architecture"]
    assert [s.heading for s in sections] == ["Why", "Architecture"]
    assert [s.depth for s in sections] == [2, 2]
    assert [s.line for s in sections] == [1, 5]
    assert [s.order for s in sections] == [1, 2]
    assert [s.body_md for s in sections] == [
        "\nSome prose.\n\n",
        "\n```mermaid\ngraph TD\n  A --> B\n```\n",
    ]


def test_marker_absent_id_equals_generate_heading_id_fallback():
    text = "## Engineering Decisions\n\nProse.\n"
    sections, _ = extract_sections(text, SRC)
    assert sections[0].id == generate_heading_id("Engineering Decisions")
    assert sections[0].heading == "Engineering Decisions"


def test_explicit_and_fallback_ids_coexist():
    text = "## Overview {#custom}\n\nA.\n\n## Results\n\nB.\n"
    sections, _ = extract_sections(text, SRC)
    assert [s.id for s in sections] == ["custom", "results"]


def test_duplicate_explicit_id_raises():
    text = "## Alpha {#dup}\n\nA.\n\n## Beta {#dup}\n\nB.\n"
    with pytest.raises(SectionError) as exc:
        extract_sections(text, SRC)
    assert "dup" in str(exc.value)
    assert "lines 1 and 5" in str(exc.value)


def test_empty_body_no_sections():
    assert extract_sections("", SRC) == ([], [])


def test_only_prose_no_sections():
    sections, _ = extract_sections("Just prose, no headings.\n\nMore.\n", SRC)
    assert sections == []


def test_heading_emphasis_text_stripped():
    text = "## **Results** {#results}\n\nImproved.\n"
    sections, _ = extract_sections(text, SRC)
    assert sections[0].heading == "Results"
    assert sections[0].id == "results"


def test_nested_headings_are_sections():
    body = "## Parent {#parent}\n\nProse.\n\n### Child {#child}\n\nDetail.\n"
    sections, _ = extract_sections(body, SRC)
    assert [s.id for s in sections] == ["parent", "child"]
    assert [s.depth for s in sections] == [2, 3]
    assert sections[0].body_md == "\nProse.\n\n"
    assert sections[1].body_md == "\nDetail.\n"


def test_last_section_body_runs_to_eof():
    text = "## A\n\nOne.\n\n## B\n\nTwo.\n"
    sections, _ = extract_sections(text, SRC)
    assert sections[1].body_md == "\nTwo.\n"


def test_rich_body_fixture_round_trips(read_fixture):
    _, body = strip_frontmatter(read_fixture("rich-body.md"))
    sections, warnings = extract_sections(body, "rich-body.md")

    assert [s.id for s in sections] == ["challenges", "metrics", "diagram"]
    challenges = [s for s in sections if s.id == "challenges"][0]
    assert "**Problem:** The video pipeline dropped frames under load." in challenges.body_md
    assert "**Q:**" in challenges.body_md
    assert "**A:**" in challenges.body_md

    metrics = [s for s in sections if s.id == "metrics"][0]
    assert "| Metric    | Before | After |" in metrics.body_md

    diagram = [s for s in sections if s.id == "diagram"][0]
    assert "```mermaid" in diagram.body_md
    assert "```python" in diagram.body_md
    assert "blockquote must survive" in diagram.body_md
    assert "![Decoded frames](/images/frames.png)" in diagram.body_md
    assert warnings == []


def test_unknown_sections_preserved(read_fixture):
    _, body = strip_frontmatter(read_fixture("unknown-section.md"))
    sections, warnings = extract_sections(body, "unknown-section.md")
    assert [s.id for s in sections] == ["known", "my-custom-thread", "nested-subsection"]
    custom = [s for s in sections if s.id == "my-custom-thread"][0]
    assert "preserved verbatim, not\nrejected" in custom.body_md
    nested = [s for s in sections if s.id == "nested-subsection"][0]
    assert nested.depth == 3
    assert warnings == []


def test_duplicate_fixture_raises(read_fixture):
    _, body = strip_frontmatter(read_fixture("duplicate-section-id.md"))
    with pytest.raises(SectionError):
        extract_sections(body, "")


def test_empty_body_fixture(read_fixture):
    _, body = strip_frontmatter(read_fixture("empty-body.md"))
    assert extract_sections(body, "") == ([], [])