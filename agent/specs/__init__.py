"""Canonical project-spec parser domain (see spec_markdown_migration_implementation_plan.md).

Phase 2: fully tested Pydantic models, frontmatter strip/parse/detect and a
markdown-it section extractor. Consumed by `spec_pipeline.py` in Phase 4.
"""

from specs.extract import SectionError, extract_sections
from specs.frontmatter import (
    FRONT_MATTER_RE,
    FrontmatterError,
    detect_canonical,
    parse_frontmatter,
    strip_frontmatter,
)
from specs.ids import generate_heading_id
from specs.models import (
    DEFAULT_TYPE,
    RECOMMENDED_IDS,
    SCHEMA_VERSION,
    MarkdownSection,
    ProjectMetadata,
    ProjectSpec,
)

__all__ = [
    "DEFAULT_TYPE",
    "RECOMMENDED_IDS",
    "SCHEMA_VERSION",
    "MarkdownSection",
    "ProjectMetadata",
    "ProjectSpec",
    "SectionError",
    "FrontmatterError",
    "FRONT_MATTER_RE",
    "detect_canonical",
    "extract_sections",
    "generate_heading_id",
    "parse_frontmatter",
    "strip_frontmatter",
]