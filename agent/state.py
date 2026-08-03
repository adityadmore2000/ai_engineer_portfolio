"""Mutable application state for the publishing agent.

Owns all global mutable state that was previously scattered across modules:
schema cache, pending-create slot. Each piece of state is encapsulated in a
class with explicit get/set/clear operations.

No module outside ``state.py`` should hold mutable global dictionaries.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import bridges


# ── Schema Cache ─────────────────────────────────────────


class SchemaCache:
    """In-process cache of the discovered project schema.

    Keyed on the mtime of ``sanity/schemaTypes/project.ts`` — adding, renaming,
    or requiring a field in Sanity Studio is picked up on the next request
    without restarting the agent.
    """

    def __init__(self, schema_file: Path) -> None:
        self._schema_file = schema_file
        self._cache: dict[str, Any] = {}

    def needs_refresh(self) -> bool:
        if not self._cache:
            return True
        try:
            return self._schema_file.stat().st_mtime != self._cache.get("_mtime")
        except OSError:
            return True

    def refresh(self) -> dict[str, Any]:
        """Fetch the schema from the bridge and update the cache."""
        r = bridges.describe_schema("project")
        if not r.success:
            raise RuntimeError(
                f"describe-schema.ts failed: {r.stderr.strip() or r.stdout.strip()}"
            )
        schema = json.loads(r.stdout)
        schema_bytes = json.dumps(schema, sort_keys=True).encode("utf-8")
        schema["_version_hash"] = hashlib.sha256(schema_bytes).hexdigest()[:16]
        try:
            schema["_mtime"] = self._schema_file.stat().st_mtime
        except OSError:
            schema["_mtime"] = 0.0
        self._cache.clear()
        self._cache.update(schema)
        return schema

    def get(self) -> dict[str, Any]:
        """Return the cached schema, refreshing if stale."""
        if self.needs_refresh():
            self.refresh()
        return dict(self._cache)


# ── Pending Create State ─────────────────────────────────


class PendingCreateState:
    """Mutable slot for the staged spec-driven project payload.

    Exactly one payload can be staged at a time. The confirmation gate
    reads, then clears, this slot on commit.
    """

    def __init__(self) -> None:
        self._pending: dict[str, Any] = {}

    @property
    def is_pending(self) -> bool:
        return bool(self._pending)

    def get(self) -> dict[str, Any]:
        """Return the current pending payload (may be empty)."""
        return self._pending

    def set(self, data: dict[str, Any]) -> None:
        """Stage a new pending create payload."""
        self._pending = data

    def clear(self) -> None:
        """Discard the pending payload."""
        self._pending = {}
