"""LangChain tool definitions for the publishing agent.

Each tool is a thin adapter that delegates to the appropriate service or
pipeline module.  No business logic lives here — tools handle only argument
unpacking, service invocation, and result forwarding.

``publish_agent.py`` imports the ``tools`` list and wires it into the graph.
"""

from __future__ import annotations

from typing import Annotated

import spec_pipeline
from services import (
    DatasetSyncService,
    FileSystemService,
    IndexService,
    ProjectService,
    PublishingService,
)

from langchain_core.tools import tool

# ── Service singletons ───────────────────────────────────

project_svc = ProjectService()
publishing_svc = PublishingService()
index_svc = IndexService()
dataset_sync_svc = DatasetSyncService()
fs_svc = FileSystemService()

# ── Read-only tools ──────────────────────────────────────


@tool
def read_file(path: Annotated[str, "Absolute or relative path to a file"]) -> str:
    """Read the entire contents of a file from disk."""
    return fs_svc.read_file(path)


@tool
def find_markdown(
    directory: Annotated[str, "Directory to search recursively"],
) -> str:
    """Find all Markdown (.md) files inside a directory."""
    return fs_svc.find_markdown(directory)


@tool
def list_dir(
    path: Annotated[str, "Directory to list"],
) -> str:
    """List entries (files and subdirectories) in a directory."""
    return fs_svc.list_dir(path)


@tool
def list_projects(
    search: Annotated[
        str | None,
        "Optional search term to filter projects by title. Omit to list all projects.",
    ] = None,
) -> str:
    """List projects in the portfolio, optionally filtered by title."""
    return project_svc.list_projects(search)


@tool
def read_project(
    slug: Annotated[str, "Project slug (URL identifier) to fetch"],
) -> str:
    """Read an existing project's current data from Sanity by slug."""
    return project_svc.read_project(slug)


# ── Lifecycle mutation tools ─────────────────────────────


@tool
def create_project(
    project_data: Annotated[
        dict,
        (
            "Structured project data for a NEW project. Fails if the slug already exists. "
            "METADATA ONLY: title (required), slug (required), shortSummary, "
            "coverImage, coverImageAlt, technologies[], keyMetrics[], "
            "githubUrl, demoUrl, featured, displayOrder, "
            "screenshots[], screenshotAlts[]. "
            "Image paths must be relative to the markdown file's directory. "
            "Narrative (long-form storytelling) is NOT a field here — use "
            "publish_docs(slug, docs_dir) after creating the project."
        ),
    ],
) -> str:
    """Create a NEW project in the Sanity CMS portfolio. Fails if slug already exists."""
    return project_svc.create_project(project_data)


@tool
def update_project(
    slug: Annotated[str, "Slug of the existing project to update"],
    project_data: Annotated[
        dict,
        (
            "Partial project data with ONLY the fields to change. "
            "The slug identifies which project to update. "
            "Only the fields you include here will be modified; all others are preserved. "
            "METADATA ONLY: title, shortSummary, coverImage, coverImageAlt, technologies[], "
            "keyMetrics[], githubUrl, demoUrl, featured, displayOrder, "
            "screenshots[], screenshotAlts[]. "
            "To change narrative documentation, use publish_docs(slug, docs_dir)."
        ),
    ],
) -> str:
    """Update specific fields of an EXISTING project. Fails if slug not found. True partial update — only included fields are changed."""
    return project_svc.update_project(slug, project_data)


@tool
def publish_project(
    slug: Annotated[str, "Slug of the project to publish"],
) -> str:
    """Publish an existing project, making it visible on the public portfolio site."""
    return publishing_svc.publish_project(slug)


@tool
def unpublish_project(
    slug: Annotated[str, "Slug of the project to unpublish"],
) -> str:
    """Unpublish an existing project, hiding it from the public portfolio site."""
    return publishing_svc.unpublish_project(slug)


@tool
def delete_project(
    slug: Annotated[str, "Project slug (URL identifier) to delete"],
) -> str:
    """Delete a project and its documentation pages from Sanity by slug."""
    return project_svc.delete_project(slug)


@tool
def publish_docs(
    slug: Annotated[str, "Slug of the existing project whose narrative to publish"],
    docs_dir: Annotated[
        str,
        (
            "Path to the project's Markdown documentation directory (e.g. "
            "projects/<slug>/docs). Every .md document inside it is "
            "deterministically serialized to Portable Text and written to "
            "project.content as a replace (stable _key ids). Absolute image "
            "paths resolve against this directory. Never mutates metadata."
        ),
    ],
) -> str:
    """Publish a project's `docs/` Markdown documentation into `project.content`.
    Serialization is deterministic and schema-free; the documents are the
    source of truth. Call this whenever the user points at a docs directory or
    asks to publish/refresh a project's narrative documentation."""
    return publishing_svc.publish_docs(slug, docs_dir)


@tool
def publish_project_spec(
    spec_path: Annotated[
        str,
        "Path to a canonical project-spec.md (frontmatter metadata + Markdown body).",
    ],
    mode: Annotated[
        str,
        '"create" for a NEW project, "update" for an existing project.',
    ] = "create",
) -> str:
    """Publish a COMPLETE project from ONE canonical project-spec.md in a single
    call: the frontmatter metadata is written via create/update AND the Markdown
    body is serialized into project.content (a replace with stable keys, so
    re-runs are idempotent). The spec body becomes the published narrative —
    this REPLACES the separate create_project + publish_docs flow for canonical
    specs. Use mode='update' when the slug already exists in Sanity."""
    return publishing_svc.publish_project_spec(spec_path, mode)


@tool
def reindex_content() -> str:
    """Rebuild the semantic search index (Qdrant) from the current Sanity
    content using a transactional, atomic index swap. Builds a temporary
    collection, validates it (count, dimensions, retrieval probe), atomically
    promotes it to production, then cleans up the previous index. Production
    search stays available throughout. Call this AFTER any content mutation
    (create_project, update_project, publish_project, unpublish_project,
    delete_project) so the vector index stays in sync with Sanity."""
    return index_svc.reindex_content()


# ── Dataset synchronization tools ────────────────────────


@tool
def sync_production_to_local() -> str:
    """Pull the latest content from the production Sanity dataset into the local
    development dataset. Exports production, then imports it into local with
    --replace. This OVERWRITES the local dataset. No slug is needed."""
    return dataset_sync_svc.sync_production_to_local()


@tool
def sync_local_to_production() -> str:
    """Promote the local development dataset up to production. Exports local,
    then imports it into production with --replace. This OVERWRITES the
    production dataset (destructive). No slug is needed. Distinct from
    publish_project(), which toggles a single project's visibility."""
    return dataset_sync_svc.sync_local_to_production()


# ── Spec-driven project creation ─────────────────────────
#
# All pipeline logic (parsing, schema discovery, normalization, validation,
# LLM repair, pending-create state, confirmation, audit) lives in
# spec_pipeline.py.  The tools below are thin adapters.


@tool
def parse_spec_file(
    path: Annotated[str, "Absolute or relative path to the Markdown spec file (.md)"],
) -> str:
    """Deterministically parse a Markdown project spec produced in the rigid
    `- **field**: value` grammar. Rejects non-Markdown files and oversized
    specs. Returns JSON: {source_dir, raw_length, fields, provenance, warnings}.

    The parser is field-name agnostic: it does not know the Sanity schema. Type
    coercion happens later against the discovered schema. Absent fields
    ('Not set - ...' / 'Not live yet - ...') are omitted, never empty strings.
    """
    return spec_pipeline.parse_spec_file(path)


@tool
def describe_project_schema() -> str:
    """Discover the current `project` document schema from the local Sanity
    Studio code (the single source of truth). Executes each field's validation
    function against a mock Rule to learn required-ness, integer/min, and uri
    schemes. The result is cached for the agent's lifetime and auto-refreshed
    only when sanity/schemaTypes/project.ts changes. Returns JSON schema."""
    return spec_pipeline.describe_project_schema()


@tool
def create_project_from_spec(
    spec_path: Annotated[str, "Path to the Markdown specification file"],
) -> str:
    """Spec-driven project creation. Reads the spec, discovers the Sanity
    project schema, deterministically maps spec fields to schema fields,
    validates, and (if needed) attempts ONE LLM self-repair retry. Does NOT
    write to Sanity — stashes the proposed payload for human confirmation.
    Reply `yes` to the agent afterwards to call confirm_pending_create()."""
    return spec_pipeline.create_project_from_spec(spec_path)


@tool
def confirm_pending_create() -> str:
    """Confirm and execute the staged spec-driven project create. Writes the
    project to Sanity (via create_project) and an audit record to .agents/."""
    return spec_pipeline.confirm_pending_create(create_project.invoke)


@tool
def cancel_pending_create() -> str:
    """Discard the staged spec-driven project payload without writing to Sanity."""
    return spec_pipeline.cancel_pending_create()


# ── Exported tool list ───────────────────────────────────

tools = [
    # Read-only
    read_file,
    find_markdown,
    list_dir,
    list_projects,
    read_project,
    # Lifecycle mutations
    create_project,
    update_project,
    publish_project,
    unpublish_project,
    delete_project,
    # Narrative publishing (Markdown docs → project.content)
    publish_docs,
    # Canonical project-spec publishing (metadata + content in one call)
    publish_project_spec,
    # Indexing trigger (transactional rebuild; no indexing logic lives here)
    reindex_content,
    # Dataset synchronization
    sync_production_to_local,
    sync_local_to_production,
    # Spec-driven creation
    parse_spec_file,
    describe_project_schema,
    create_project_from_spec,
    confirm_pending_create,
    cancel_pending_create,
]
