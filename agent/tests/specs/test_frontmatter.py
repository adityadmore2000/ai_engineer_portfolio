from __future__ import annotations

import re

import pytest

from specs.frontmatter import (
    FrontmatterError,
    detect_canonical,
    parse_frontmatter,
    strip_frontmatter,
)

CANONICAL = """\
---
schema_version: 1
type: project
slug: demo
title: Demo
---

## Section {#s}

Body text.
"""

# Exact port of `lib/content/discover-docs.ts:50` FRONT_MATTER_RE for parity.
TS_FRONT_MATTER_RE = re.compile(r"^---\r?\n([\s\S]*?)\r?\n---\r?\n?")


def test_strip_at_position_zero():
    fm, body = strip_frontmatter(CANONICAL)
    assert fm is not None
    assert "schema_version: 1" in fm
    assert body.startswith("## Section {#s}")


def test_strip_no_frontmatter_returns_whole_body():
    text = "## Plain\n\nNo delimiters."
    fm, body = strip_frontmatter(text)
    assert fm is None
    assert body == text


def test_delimiter_must_be_at_position_zero():
    text = "Lead prose.\n\n---\nschema_version: 1\n---\n\n## Late"
    fm, body = strip_frontmatter(text)
    assert fm is None
    assert body == text


def test_unclosed_delimiter_is_not_stripped():
    text = "---\nschema_version: 1\ntitle: X\n"
    fm, body = strip_frontmatter(text)
    assert fm is None
    assert body == text


def test_parse_valid_yaml_mapping():
    parsed = parse_frontmatter("schema_version: 1\ntype: project\nshortSummary: Hi")
    assert parsed == {"schema_version": 1, "type": "project", "shortSummary": "Hi"}


def test_parse_empty_and_none():
    assert parse_frontmatter("") == {}
    assert parse_frontmatter(None) == {}


def test_parse_bad_yaml_raises_structured_error():
    with pytest.raises(FrontmatterError) as exc:
        parse_frontmatter('title: "unterminated quote')
    assert "YAML" in str(exc.value) or "front-matter" in str(exc.value)


def test_parse_non_mapping_root_raises():
    with pytest.raises(FrontmatterError):
        parse_frontmatter("- a\n- b")


def test_detect_canonical():
    assert detect_canonical({"schema_version": 1, "type": "project"}) is True
    assert detect_canonical({}) is False
    assert detect_canonical({"type": "project"}) is False
    assert detect_canonical(None) is False


def test_malformed_frontmatter_fixture_raises(read_fixture):
    fm, _body = strip_frontmatter(read_fixture("malformed-frontmatter.md"))
    assert fm is not None
    with pytest.raises(FrontmatterError):
        parse_frontmatter(fm)


@pytest.mark.parametrize(
    "text",
    [
        "---\nschema_version: 1\n---\nbody",
        "---\r\nschema_version: 1\r\n---\r\nbody",
        "---\nschema_version: 1\n---\n## H {#x}",
        "---\na: 1\n---",
        "no leading delimiter at all",
        "---\nunclosed",
        "---",  # closing delimiter at EOF, nothing after
    ],
)
def test_regex_parity_with_discover_docs(text):
    fm, body = strip_frontmatter(text)
    ts_match = TS_FRONT_MATTER_RE.match(text)
    if ts_match is None:
        assert fm is None
    else:
        assert fm == ts_match.group(1)
        assert body == text[ts_match.end():].strip()


def test_crlf_canonical_parity(read_fixture):
    raw = "---\r\nschema_version: 1\r\ntype: project\r\n---\r\nbody\r\n"
    fm, body = strip_frontmatter(raw)
    assert fm == "schema_version: 1\r\ntype: project"
    assert parse_frontmatter(fm) == {"schema_version": 1, "type": "project"}