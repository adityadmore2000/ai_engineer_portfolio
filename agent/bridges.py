"""Bridge execution layer for the publishing agent.

Single abstraction over the TypeScript bridge scripts in ``scripts/``.
Every subprocess invocation against a bridge lives here — ``publish_agent.py``
never calls ``subprocess.run`` directly.
"""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent


# ── Result type ──────────────────────────────────────────


@dataclass
class BridgeResult:
    """Raw result from a bridge script execution."""

    success: bool
    stdout: str
    stderr: str


# ── Internal execution helper ────────────────────────────


def _run_bridge(
    script: str,
    args: list[str] | None = None,
    *,
    timeout: int | None = None,
) -> BridgeResult:
    """Execute a TypeScript bridge script via ``npx tsx``.

    Parameters
    ----------
    script:
        Filename of the bridge script inside ``scripts/`` (e.g. ``"list-projects.ts"``).
    args:
        Positional arguments forwarded to the script.
    timeout:
        Optional ``subprocess.run`` timeout in seconds.
    """
    bridge_path = PROJECT_ROOT / "scripts" / script
    cmd = ["npx", "tsx", str(bridge_path)]
    if args:
        cmd.extend(args)

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
        timeout=timeout,
    )

    return BridgeResult(
        success=result.returncode == 0,
        stdout=result.stdout,
        stderr=result.stderr,
    )


# ── Temp-file helper ────────────────────────────────────


def write_json_tempfile(data: dict[str, Any]) -> str:
    """Write *data* to a temporary JSON file and return its path.

    The caller is responsible for deleting the file when done (typically in a
    ``try/finally`` block).
    """
    fd, tmp_path = tempfile.mkstemp(suffix=".json", prefix="project_")
    with os.fdopen(fd, "w") as f:
        json.dump(data, f, indent=2)
    return tmp_path


# ── Public bridge functions ──────────────────────────────


def list_projects(search: str | None = None) -> BridgeResult:
    """List projects, optionally filtered by title."""
    args = [search] if search else []
    return _run_bridge("list-projects.ts", args)


def read_project(slug: str) -> BridgeResult:
    """Read a single project's data by slug."""
    return _run_bridge("read-project.ts", [slug])


def create_project(json_path: str) -> BridgeResult:
    """Create a new project from a JSON file."""
    return _run_bridge("create-project.ts", [json_path])


def update_project(json_path: str, slug: str) -> BridgeResult:
    """Update an existing project from a JSON file."""
    return _run_bridge("update-project.ts", [json_path, slug])


def publish_project(slug: str) -> BridgeResult:
    """Set ``published = true`` on a project."""
    return _run_bridge("publish-project.ts", [slug])


def unpublish_project(slug: str) -> BridgeResult:
    """Set ``published = false`` on a project."""
    return _run_bridge("unpublish-project.ts", [slug])


def delete_project(slug: str) -> BridgeResult:
    """Delete a project and its documentation pages."""
    return _run_bridge("delete-project.ts", [slug])


def publish_docs(slug: str, docs_dir: str) -> BridgeResult:
    """Serialize Markdown docs into Portable Text on ``project.content``."""
    return _run_bridge("publish-docs.ts", [slug, docs_dir])


def reindex_content() -> BridgeResult:
    """Transactionally rebuild the Qdrant semantic search index."""
    return _run_bridge("index-content.ts", timeout=900)


def sync_dataset(direction: str) -> BridgeResult:
    """Synchronize Sanity datasets.

    Parameters
    ----------
    direction:
        ``"prod-to-local"`` or ``"local-to-prod"``.
    """
    return _run_bridge("sync-dataset.ts", [direction])


def describe_schema(doc_type: str) -> BridgeResult:
    """Discover the live Sanity schema for *doc_type*."""
    return _run_bridge("describe-schema.ts", [doc_type])
