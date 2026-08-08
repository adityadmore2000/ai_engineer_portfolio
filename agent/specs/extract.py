from __future__ import annotations

import re

from markdown_it import MarkdownIt

from specs.ids import generate_heading_id
from specs.models import MarkdownSection

"""Section extractor for the canonical spec body.

Uses `markdown-it-py` tokens to walk headings (depth 1-6) and slices the
original source string (line-based) for each section's `body_md` so it is
preserved verbatim — the TS serializer must see identical text.
"""

MARKER_RE = re.compile(r"\s*\{#([a-z0-9][a-z0-9-]*[a-z0-9])\}\s*$")

_md = MarkdownIt("commonmark")


class SectionError(ValueError):
    """Structured, deterministic fatal error for a spec body."""


def _heading_text(token) -> str:
    """Plain heading text with inline markup removed.

    `inline.content` retains Markdown markers (`## **Results**` → content
    `**Results**`); the render text is the concatenation of `text` / `code_inline`
    children only.
    """
    if token is None:
        return ""
    children = getattr(token, "children", None)
    if not children:
        return ""
    return "".join(c.content for c in children if c.type in ("text", "code_inline"))


def _collect_headings(body_md: str) -> list[dict]:
    """Ordered heading entries: {start, end, depth, raw} (0-indexed lines)."""
    entries: list[dict] = []
    tokens = _md.parse(body_md or "")
    for i, tok in enumerate(tokens):
        if tok.type == "heading_open":
            inline = tokens[i + 1] if i + 1 < len(tokens) else None
            raw = _heading_text(inline)
            map_ = tok.map
            start, end = (map_[0], map_[1]) if map_ else (0, 0)
            entries.append(
                {
                    "start": start,
                    "end": end,
                    "depth": int(tok.tag[1]),
                    "raw": raw,
                }
            )
    return entries


def extract_sections(
    body_md: str, source: str
) -> tuple[list[MarkdownSection], list[str]]:
    """Split `body_md` into heading-anchored sections.

    Returns (sections, warnings). Raises `SectionError` on a deterministic
    fatal problem (duplicate explicit `{#id}`), consistent with the
    `duplicate-section-id.md` fixture.
    """
    warnings: list[str] = []
    entries = _collect_headings(body_md)
    if not entries:
        return [], warnings

    lines = body_md.splitlines(keepends=True)
    sections: list[MarkdownSection] = []
    seen_explicit: dict[str, int] = {}

    for order, entry in enumerate(entries, start=1):
        marker_match = MARKER_RE.search(entry["raw"])
        if marker_match:
            section_id = marker_match.group(1)
            heading = entry["raw"][: marker_match.start()].rstrip()
        else:
            heading = entry["raw"].strip()
            section_id = generate_heading_id(heading)

        if marker_match is not None:
            if section_id in seen_explicit:
                raise SectionError(
                    f"{source}: duplicate explicit section id {section_id!r} at "
                    f"lines {seen_explicit[section_id]} and {entry['start'] + 1}."
                )
            seen_explicit[section_id] = entry["start"] + 1

        sections.append(
            MarkdownSection(
                id=section_id,
                heading=heading,
                depth=entry["depth"],
                order=order,
                line=entry["start"] + 1,
                body_md="",
            )
        )

    for i, entry in enumerate(entries):
        start_body = entry["end"]
        next_start = entries[i + 1]["start"] if i + 1 < len(entries) else len(lines)
        sections[i].body_md = "".join(lines[start_body:next_start])

    return sections, warnings