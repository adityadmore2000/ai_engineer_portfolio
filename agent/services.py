"""Application service layer for the publishing agent.

Services own business workflow orchestration — validation, temp-file lifecycle,
error formatting, and result normalization.  They sit between the LangChain
tools (thin adapters) and the bridge layer (subprocess execution).

``publish_agent.py`` tools delegate to services; services delegate to bridges.
"""

from __future__ import annotations

import os
from typing import Any

import bridges


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
    """Publish/unpublish projects and publish narrative documentation."""

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

    def publish_docs(self, slug: str, docs_dir: str) -> str:
        """Serialize Markdown docs into Portable Text on ``project.content``."""
        r = bridges.publish_docs(slug, docs_dir)
        if not r.success:
            return f"Error publishing docs:\n{r.stderr.strip() or r.stdout.strip()}"
        return r.stdout.strip()


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
