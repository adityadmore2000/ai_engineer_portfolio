from __future__ import annotations

import re
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

"""Typed domain model for the canonical `project-spec.md` format.

Field names mirror Sanity schema field names (Phase 4 feeds
`metadata.model_dump(exclude_unset=True)` into `normalize_and_validate`).
"""

SCHEMA_VERSION = 1
DEFAULT_TYPE = "project"

_STATUS_VALUES = ("active", "completed", "archived", "poc", "in-development")

RECOMMENDED_IDS = (
    "overview", "problem", "objective", "target-users", "architecture",
    "engineering-decisions", "challenges", "results", "lessons-limitations",
    "future-improvements", "faq",
)


class MarkdownSection(BaseModel):
    """A heading-anchored slice of the spec body."""

    id: str          # `{#id}` marker, or generateHeadingId fallback
    heading: str     # heading text WITHOUT the `{#id}` marker
    depth: int       # 1-6
    order: int       # authoring position
    line: int        # 1-indexed heading line in the file (provenance)
    body_md: str     # raw Markdown slice under this heading (preserved verbatim)


class ProjectMetadata(BaseModel):
    """Machine-only metadata. Field names == Sanity schema field names."""

    model_config = ConfigDict(extra="allow")  # unknown keys collected in `model_extra`

    schema_version: Literal[1] = 1
    type: Literal["project"] = "project"
    title: str = Field(min_length=1, max_length=96)
    slug: str = Field(pattern=r"[a-z0-9][a-z0-9-]{0,94}[a-z0-9]?")

    shortSummary: Optional[str] = None
    status: Optional[Literal["active", "completed", "archived", "poc", "in-development"]] = None
    technologies: list[str] = Field(default_factory=list)
    keyMetrics: list[str] = Field(default_factory=list)

    githubUrl: Optional[str] = None   # validated later by the uri-constraint path (parity)
    demoUrl: Optional[str] = None
    demoVideo: Optional[str] = None

    coverImage: Optional[str] = None       # absolute path (enforced)
    coverImageAlt: Optional[str] = None
    screenshots: list[str] = Field(default_factory=list)
    screenshotAlts: list[str] = Field(default_factory=list)

    featured: Optional[bool] = None          # absent → schema default semantics
    displayOrder: Optional[int] = Field(None, ge=0)

    @field_validator("slug")
    @classmethod
    def _slug_must_be_url_safe(cls, value: str) -> str:
        """Enforce slug shape with fullmatch (pydantic's `pattern` uses search).

        Fifth with the pipeline's check in `spec_pipeline.py` (re.fullmatch of
        `[a-z0-9](?:[a-z0-9-]*[a-z0-9])?`).
        """
        if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?", value):
            raise ValueError("slug must be lowercase, URL-safe (a-z0-9 and hyphens), no leading/trailing hyphen")
        return value


class ProjectSpec(BaseModel):
    source_path: str
    source_dir: str
    raw_sha256: str
    raw_length: int
    format: Literal["frontmatter"]
    metadata: ProjectMetadata
    body_md: str = ""                        # full body; `{#id}` markers intact
    sections: list[MarkdownSection] = Field(default_factory=list)
    unknown_meta: list[tuple[str, object]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    def section_id(self, target: str) -> Optional[MarkdownSection]:
        return next((s for s in self.sections if s.id == target), None)