"""Application service layer for the publishing agent.

Services own business workflow orchestration — validation, temp-file lifecycle,
error formatting, and result normalization.  They sit between the LangChain
tools (thin adapters) and the bridge layer (subprocess execution).

``publish_agent.py`` tools delegate to services; services delegate to bridges.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import bridges
import spec_pipeline


# ── ProjectService ───────────────────────────────────────


class ProjectService:
    """CRUD operations on portfolio projects.

    Handles required-field validation, temporary JSON file lifecycle,
    bridge invocation, and result formatting.
    """

    def list_projects(self, search: str | None = None) -> str:
        """List projects, optionally filtered by title."""
        r = bridges.list_projects(search)
        if not r.success:
            return f"Error: {r.stderr.strip()}"
        return r.stdout.strip()

    def read_project(self, slug: str) -> str:
        """Read a single project's current data from Sanity by slug."""
        r = bridges.read_project(slug)
        if not r.success:
            return f"Error: {r.stderr.strip()}"
        return r.stdout.strip()

    def create_project(self, project_data: dict[str, Any]) -> str:
        """Create a new project in Sanity.

        Validates required fields, writes a temp JSON file, invokes the
        bridge, and cleans up the temp file.
        """
        required = ("title", "slug")
        missing = [f for f in required if not project_data.get(f)]
        if missing:
            return f"Error: missing required fields: {', '.join(missing)}"

        tmp_path = bridges.write_json_tempfile(project_data)
        try:
            r = bridges.create_project(tmp_path)
            if not r.success:
                return f"Error creating project:\n{r.stderr.strip()}"
            return r.stdout.strip()
        finally:
            os.unlink(tmp_path)

    def update_project(self, slug: str, project_data: dict[str, Any]) -> str:
        """Update specific fields of an existing project.

        Writes a temp JSON file with the partial payload, invokes the
        bridge, and cleans up.
        """
        tmp_path = bridges.write_json_tempfile(project_data)
        try:
            r = bridges.update_project(tmp_path, slug)
            if not r.success:
                return f"Error updating project:\n{r.stderr.strip()}"
            return r.stdout.strip()
        finally:
            os.unlink(tmp_path)

    def delete_project(self, slug: str) -> str:
        """Delete a project and its documentation pages from Sanity."""
        r = bridges.delete_project(slug)
        if not r.success:
            return f"Error: {r.stderr.strip()}"
        return r.stdout.strip()


# ── PublishingService ────────────────────────────────────


class PublishingService:
    """Publish/unpublish projects and publish complete project specs."""

    def publish_project(self, slug: str) -> str:
        """Set a project as visible on the public portfolio site."""
        r = bridges.publish_project(slug)
        if not r.success:
            return f"Error publishing project:\n{r.stderr.strip()}"
        return r.stdout.strip()

    def unpublish_project(self, slug: str) -> str:
        """Hide a project from the public portfolio site."""
        r = bridges.unpublish_project(slug)
        if not r.success:
            return f"Error unpublishing project:\n{r.stderr.strip()}"
        return r.stdout.strip()

    def publish_project_spec(self, spec_path: str, mode: str = "create") -> str:
        """Publish a COMPLETE project from one canonical ``project-spec.md``.

        The spec pipeline parses + validates the metadata (with ONE LLM
        self-repair retry on failure) and hands the payload to the
        ``publish-project-spec.ts`` bridge, which writes metadata AND replaces
        ``project.content`` with the serialized body in a single call.
        """
        return spec_pipeline.publish_project_spec(spec_path, mode)


# ── IndexService ─────────────────────────────────────────


class IndexService:
    """Semantic search index management."""

    def reindex_content(self) -> str:
        """Transactionally rebuild the Qdrant semantic search index."""
        r = bridges.reindex_content()
        if not r.success:
            return f"Error reindexing:\n{r.stderr.strip() or r.stdout.strip()}"
        return r.stdout.strip() or "Reindex complete."


# ── DatasetSyncService ───────────────────────────────────


class DatasetSyncService:
    """Sanity dataset synchronization between environments."""

    def sync_production_to_local(self) -> str:
        """Pull production down into the local dev dataset."""
        r = bridges.sync_dataset("prod-to-local")
        if not r.success:
            return f"Error syncing production → local:\n{r.stderr.strip()}"
        return r.stdout.strip() or "Synced production → local."

    def sync_local_to_production(self) -> str:
        """Promote the local dev dataset up to production."""
        r = bridges.sync_dataset("local-to-prod")
        if not r.success:
            return f"Error syncing local → production:\n{r.stderr.strip()}"
        return r.stdout.strip() or "Synced local → production."


# ── FileSystemService ────────────────────────────────────


class FileSystemService:
    """Read-only filesystem operations (file reading, directory listing, search)."""

    def read_file(self, path: str) -> str:
        """Read the entire contents of a file from disk."""
        p = Path(path).expanduser().resolve()
        if not p.exists():
            return f"Error: file not found at {p}"
        return p.read_text(encoding="utf-8")

    def find_markdown(self, directory: str) -> str:
        """Find all Markdown (.md) files inside a directory recursively."""
        d = Path(directory).expanduser().resolve()
        if not d.is_dir():
            return f"Error: directory not found at {d}"
        files = sorted(d.rglob("*.md"))
        if not files:
            return f"No Markdown files found in {d}"
        return "\n".join(str(f.relative_to(d)) for f in files)

    def list_dir(self, path: str) -> str:
        """List entries (files and subdirectories) in a directory."""
        d = Path(path).expanduser().resolve()
        if not d.is_dir():
            return f"Error: directory not found at {d}"
        entries = sorted(os.listdir(d))
        return "\n".join(entries)
