from __future__ import annotations

import re

"""Python port of `generateHeadingId` bare mode (`lib/content/headings.ts:22`).

Must agree with the TS implementation so Python-derived fallback section ids
match the published anchors. Keyed mode and the `used` dedup map are TS-only
(doc-page TOC / splitter); this module covers the bare default only.
"""

_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")


def generate_heading_id(title: str) -> str:
    base = _NON_ALNUM_RE.sub("-", title.lower().strip()).strip("-")
    return base or "section"