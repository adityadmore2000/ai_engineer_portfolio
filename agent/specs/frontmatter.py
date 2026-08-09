from __future__ import annotations

import re
from typing import Any, Optional

import yaml

"""Frontmatter strip / parse / canonical detection.

The delimiter regex is a parity copy of `lib/content/frontmatter.ts`
(`FRONT_MATTER_RE`), the single existing authority for frontmatter stripping.
"""

FRONT_MATTER_RE = re.compile(r"^---\r?\n([\s\S]*?)\r?\n---\r?\n?")


class FrontmatterError(ValueError):
    """Structured error for malformed or non-mapping frontmatter."""


def strip_frontmatter(text: str) -> tuple[Optional[str], str]:
    """Split `text` into (frontmatter_str | None, body_md).

    Only a `---` block anchored at position 0 is recognized. The body is the
    slice after the delimiter, stripped like `lib/content/frontmatter.ts`
    (`raw = text.slice(match[0].length).trim()`). When no delimiter is present
    the body is the whole input (verbatim).
    """
    match = FRONT_MATTER_RE.match(text)
    if not match:
        return None, text
    return match.group(1), text[match.end():].strip()


def parse_frontmatter(yaml_str: Optional[str]) -> dict[str, Any]:
    """Parse a frontmatter string into a mapping.

    Empty / absent frontmatter → {}. Invalid YAML or a non-mapping root raises
    a deterministic `FrontmatterError`.
    """
    if yaml_str is None or not yaml_str.strip():
        return {}
    try:
        parsed = yaml.safe_load(yaml_str)
    except yaml.YAMLError as exc:
        raise FrontmatterError(f"Malformed YAML front-matter: {exc}") from exc
    if parsed is None:
        return {}
    if not isinstance(parsed, dict):
        raise FrontmatterError("front-matter must be a YAML mapping")
    return parsed


def detect_canonical(meta: Optional[dict[str, Any]]) -> bool:
    """True when the metadata marks the canonical format.

    Canonical = `schema_version` present. Files without it (including legacy
    bullet specs) are rejected by `parse_spec_file`.
    """
    return isinstance(meta, dict) and meta.get("schema_version") is not None
