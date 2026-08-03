#!/usr/bin/env python3

"""AI portfolio publishing agent.

Natural-language interface for managing projects in a Sanity CMS portfolio.
Supports the full lifecycle: create, read, update, publish, unpublish, delete.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any, Optional

import bridges

from langchain_ollama import ChatOllama
from langgraph.graph import StateGraph, MessagesState
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import SystemMessage, ToolMessage
from langchain_core.tools import tool
from pydantic import BaseModel, ValidationError, create_model

# ── Configuration ────────────────────────────────────────

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:4b")
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Maximum characters of extracted spec text the agent will accept before
# refusing (protects the model's context window). Override via env.
SPEC_MAX_CHARS = int(os.environ.get("SPEC_MAX_CHARS", "30000"))

# Schema source file — the agent watches its mtime to invalidate the cached
# discovered schema, so adding/renaming/requiring a field in Sanity Studio
# is picked up on the next request without restarting the agent.
SCHEMA_FILE = PROJECT_ROOT / "sanity" / "schemaTypes" / "project.ts"

# Alt-text pseudo-fields carried alongside image fields (a publish-tool
# convention; not part of the Sanity schema proper).
IMAGE_ALT_PSEUDO_FIELDS = {
    "coverImage": "coverImageAlt",          # singular image -> single alt string
    "screenshots": "screenshotAlts",         # image array -> list of alt strings
}

# In-process cache of the discovered project schema + per-field meta.
_SCHEMA_CACHE: dict[str, Any] = {}

# ── Read-only tools ──────────────────────────────────────


@tool
def read_file(path: Annotated[str, "Absolute or relative path to a file"]) -> str:
    """Read the entire contents of a file from disk."""
    p = Path(path).expanduser().resolve()
    if not p.exists():
        return f"Error: file not found at {p}"
    return p.read_text(encoding="utf-8")


@tool
def find_markdown(
    directory: Annotated[str, "Directory to search recursively"],
) -> str:
    """Find all Markdown (.md) files inside a directory."""
    d = Path(directory).expanduser().resolve()
    if not d.is_dir():
        return f"Error: directory not found at {d}"
    files = sorted(d.rglob("*.md"))
    if not files:
        return f"No Markdown files found in {d}"
    return "\n".join(str(f.relative_to(d)) for f in files)


@tool
def list_dir(
    path: Annotated[str, "Directory to list"],
) -> str:
    """List entries (files and subdirectories) in a directory."""
    d = Path(path).expanduser().resolve()
    if not d.is_dir():
        return f"Error: directory not found at {d}"
    entries = sorted(os.listdir(d))
    return "\n".join(entries)


@tool
def list_projects(
    search: Annotated[
        str | None,
        "Optional search term to filter projects by title. Omit to list all projects.",
    ] = None,
) -> str:
    """List projects in the portfolio, optionally filtered by title."""
    r = bridges.list_projects(search)
    if not r.success:
        return f"Error: {r.stderr.strip()}"
    return r.stdout.strip()


@tool
def read_project(
    slug: Annotated[str, "Project slug (URL identifier) to fetch"],
) -> str:
    """Read an existing project's current data from Sanity by slug."""
    r = bridges.read_project(slug)
    if not r.success:
        return f"Error: {r.stderr.strip()}"
    return r.stdout.strip()


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
    tmp_path = bridges.write_json_tempfile(project_data)
    try:
        r = bridges.update_project(tmp_path, slug)
        if not r.success:
            return f"Error updating project:\n{r.stderr.strip()}"
        return r.stdout.strip()
    finally:
        os.unlink(tmp_path)


@tool
def publish_project(
    slug: Annotated[str, "Slug of the project to publish"],
) -> str:
    """Publish an existing project, making it visible on the public portfolio site."""
    r = bridges.publish_project(slug)
    if not r.success:
        return f"Error publishing project:\n{r.stderr.strip()}"
    return r.stdout.strip()


@tool
def unpublish_project(
    slug: Annotated[str, "Slug of the project to unpublish"],
) -> str:
    """Unpublish an existing project, hiding it from the public portfolio site."""
    r = bridges.unpublish_project(slug)
    if not r.success:
        return f"Error unpublishing project:\n{r.stderr.strip()}"
    return r.stdout.strip()


@tool
def delete_project(
    slug: Annotated[str, "Project slug (URL identifier) to delete"],
) -> str:
    """Delete a project and its documentation pages from Sanity by slug."""
    r = bridges.delete_project(slug)
    if not r.success:
        return f"Error: {r.stderr.strip()}"
    return r.stdout.strip()


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
    r = bridges.publish_docs(slug, docs_dir)
    if not r.success:
        return f"Error publishing docs:\n{r.stderr.strip() or r.stdout.strip()}"
    return r.stdout.strip()


@tool
def reindex_content() -> str:
    """Rebuild the semantic search index (Qdrant) from the current Sanity
    content using a transactional, atomic index swap. Builds a temporary
    collection, validates it (count, dimensions, retrieval probe), atomically
    promotes it to production, then cleans up the previous index. Production
    search stays available throughout. Call this AFTER any content mutation
    (create_project, update_project, publish_project, unpublish_project,
    delete_project) so the vector index stays in sync with Sanity."""
    r = bridges.reindex_content()
    if not r.success:
        return f"Error reindexing:\n{r.stderr.strip() or r.stdout.strip()}"
    return r.stdout.strip() or "Reindex complete."


# ── Dataset synchronization tools ────────────────────────


@tool
def sync_production_to_local() -> str:
    """Pull the latest content from the production Sanity dataset into the local
    development dataset. Exports production, then imports it into local with
    --replace. This OVERWRITES the local dataset. No slug is needed."""
    r = bridges.sync_dataset("prod-to-local")
    if not r.success:
        return f"Error syncing production → local:\n{r.stderr.strip()}"
    return r.stdout.strip() or "Synced production → local."


@tool
def sync_local_to_production() -> str:
    """Promote the local development dataset up to production. Exports local,
    then imports it into production with --replace. This OVERWRITES the
    production dataset (destructive). No slug is needed. Distinct from
    publish_project(), which toggles a single project's visibility."""
    r = bridges.sync_dataset("local-to-prod")
    if not r.success:
        return f"Error syncing local → production:\n{r.stderr.strip()}"
    return r.stdout.strip() or "Synced local → production."


# ── Spec-driven project creation ("add project considering this spec") ──
#
# Pipeline (see AGENTS.md for the full architecture):
#
#   parse_spec_file(path)                  deterministic Markdown parser
#        ↓
#   describe_project_schema()              discovers schema from Sanity Studio
#        ↓                                   (cached, mtime-keyed, auto-refresh)
#   _normalize_and_validate(parsed, schema)  deterministic type coercion + checks
#        ↓
#   (if errors) _llm_repair(...)            1 self-repair retry via structured output
#        ↓
#   create_project_from_spec(path)         orchestrator: stashes PENDING_CREATE,
#                                        returns proposed payload + provenance
#        ↓
#   <human confirmation gate>
#        ↓
#   confirm_pending_create()              writes to Sanity + audit log
#
# The agent is a schema-aware MAPPER, never an author: it copies spec content
# verbatim into the matching Sanity field, coerces types, and flags uncertain
# mappings. It does not rewrite, summarize, or invent content.


# Bullet grammar: `- **field**: inline` or `- **field**:\n  <indented block>`.
_BULLET_RE = re.compile(r"^-\s+\*\*([^*]+)\*\*:\s?(.*)$")
_SUBBULLET_RE = re.compile(r"^\s+-\s+(.*)$")
_ABSENT_PREFIXES = ("not set", "not live", "not available", "not applicable")


def _is_absent(value: str) -> bool:
    """Detect spec markers that mean 'this field is intentionally not set'."""
    return value.strip().lower().startswith(_ABSENT_PREFIXES) or value.strip().lower() in {
        "none",
        "n/a",
        "",
    }


def _strip_quotes(value: str) -> str:
    v = value.strip()
    if len(v) >= 2 and v[0] in "\"'" and v[-1] == v[0]:
        return v[1:-1]
    if len(v) >= 2 and v[0] == "`" and v[-1] == "`":
        return v[1:-1]
    return v


def parse_spec_text(md_text: str) -> tuple[dict[str, Any], dict[str, int]]:
    """Parse the rigid `- **field**: value` Markdown grammar used by spec files.

    Returns (fields, provenance) where provenance maps field name -> 1-indexed
    line number of the bullet that defined it.
    """
    lines = md_text.splitlines()
    fields: dict[str, Any] = {}
    provenance: dict[str, int] = {}

    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        m = _BULLET_RE.match(line)
        if not m:
            i += 1
            continue

        field_name = m.group(1).strip()
        inline = m.group(2).strip()
        bullet_line = i + 1  # 1-indexed

        # Collect the indented block that follows (until a non-indented,
        # non-blank line). Blank lines terminate the block — matching the
        # single-paragraph convention used in the reference spec.
        block_lines: list[str] = []
        j = i + 1
        while j < n:
            nxt = lines[j]
            if nxt.strip() == "":
                break
            if re.match(r"^\s+\S", nxt):
                block_lines.append(nxt)
                j += 1
                continue
            break

        if inline and _is_absent(inline):
            i = j
            continue

        if block_lines and all(not _SUBBULLET_RE.match(b) for b in block_lines):
            # Prose: dedent each line and join with newlines.
            prose = "\n".join(re.sub(r"^\s+", "", b).rstrip() for b in block_lines).strip()
            if _is_absent(prose):
                i = j
                continue
            fields[field_name] = prose
            provenance[field_name] = bullet_line
            i = j
            continue

        if block_lines and _SUBBULLET_RE.match(block_lines[0] or ""):
            # Array of sub-bullets.
            items: list[str] = []
            for b in block_lines:
                sm = _SUBBULLET_RE.match(b)
                if sm:
                    items.append(_strip_quotes(sm.group(1)))
                elif b.strip():
                    items.append(_strip_quotes(b.strip()))
            if not items:
                i = j
                continue
            fields[field_name] = items
            provenance[field_name] = bullet_line
            i = j
            continue

        # Inline scalar.
        scalar = _strip_quotes(inline)
        if _is_absent(scalar):
            i = j
            continue
        fields[field_name] = scalar
        provenance[field_name] = bullet_line
        i = j

    return fields, provenance


_IMAGE_FIELD_NAMES = {"coverImage", "screenshots"}


def _enforce_absolute_image_paths(fields: dict[str, Any]) -> list[str]:
    """Reject relative image paths (policy: absolute only). Returns warnings."""
    warnings: list[str] = []
    for name in _IMAGE_FIELD_NAMES:
        val = fields.get(name)
        if val is None:
            continue
        paths = val if isinstance(val, list) else [val]
        for p in paths:
            if not isinstance(p, str) or not Path(p).is_absolute():
                warnings.append(
                    f"Image path for '{name}' must be absolute (got {p!r}); "
                    "this field will be dropped unless corrected."
                )
    return warnings


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
    p = Path(path).expanduser().resolve()
    if not p.exists():
        return f"Error: spec file not found at {p}"
    if p.suffix.lower() != ".md":
        return f"Error: only Markdown (.md) specs are supported in v1 (got {p.suffix or 'no extension'})"

    md_text = p.read_text(encoding="utf-8")
    if len(md_text) > SPEC_MAX_CHARS:
        return (
            f"Error: spec is {len(md_text)} chars, exceeds SPEC_MAX_CHARS={SPEC_MAX_CHARS}. "
            "Split the spec or raise SPEC_MAX_CHARS in the environment."
        )

    fields, provenance = parse_spec_text(md_text)
    warnings = _enforce_absolute_image_paths(fields)

    return json.dumps(
        {
            "source_dir": str(p.parent),
            "spec_path": str(p),
            "raw_length": len(md_text),
            "fields": fields,
            "provenance": provenance,
            "warnings": warnings,
            "spec_sha256": hashlib.sha256(md_text.encode("utf-8")).hexdigest(),
        },
        indent=2,
    )


# ── Schema discovery (cache keyed on mtime of project.ts) ──


def _schema_needs_refresh() -> bool:
    if not _SCHEMA_CACHE:
        return True
    try:
        return SCHEMA_FILE.stat().st_mtime != _SCHEMA_CACHE.get("_mtime")
    except OSError:
        return True


def _refresh_schema_cache() -> dict[str, Any]:
    r = bridges.describe_schema("project")
    if not r.success:
        raise RuntimeError(
            f"describe-schema.ts failed: {r.stderr.strip() or r.stdout.strip()}"
        )
    schema = json.loads(r.stdout)
    schema_bytes = json.dumps(schema, sort_keys=True).encode("utf-8")
    schema["_version_hash"] = hashlib.sha256(schema_bytes).hexdigest()[:16]
    try:
        schema["_mtime"] = SCHEMA_FILE.stat().st_mtime
    except OSError:
        schema["_mtime"] = 0.0
    _SCHEMA_CACHE.clear()
    _SCHEMA_CACHE.update(schema)
    return schema


def get_discovered_schema() -> dict[str, Any]:
    if _schema_needs_refresh():
        _refresh_schema_cache()
    return dict(_SCHEMA_CACHE)


@tool
def describe_project_schema() -> str:
    """Discover the current `project` document schema from the local Sanity
    Studio code (the single source of truth). Executes each field's validation
    function against a mock Rule to learn required-ness, integer/min, and uri
    schemes. The result is cached for the agent's lifetime and auto-refreshed
    only when sanity/schemaTypes/project.ts changes. Returns JSON schema."""
    try:
        schema = get_discovered_schema()
    except Exception as exc:  # noqa: BLE001
        return f"Error discovering schema: {exc}"
    # Strip internal keys before returning to the model.
    out = {k: v for k, v in schema.items() if not k.startswith("_")}
    return json.dumps(out, indent=2)


# ── Deterministic normalization + validation against the discovered schema ──


_SCALAR_PY = {
    "string": str,
    "markdown": str,
    "text": str,
    "url": str,
    "number": float,
    "boolean": bool,
}


def _writable_field_types(schema: dict[str, Any]) -> dict[str, str]:
    """Map field name -> normalized type for fields the agent may populate."""
    out: dict[str, str] = {}
    for f in schema.get("fields", []):
        name = f.get("name")
        ftype = f.get("type")
        if not name or name in (
            "title",
            "slug",
            "published",
            "detailedContent",
            # `content` is derived narrative storage — written exclusively by the
            # publish_docs bridge, never via the metadata path. Excluded so the
            # generic setGenericFields path can never clobber it (Risk R7).
            "content",
        ):
            continue
        if ftype in _SCALAR_PY or ftype == "image":
            out[name] = ftype
        elif ftype == "array":
            item = (f.get("of") or [{}])[0]
            itype = item.get("type")
            if itype == "string":
                out[name] = "array<string>"
            elif itype == "image":
                out[name] = "array<image>"
            # block content (Portable Text) is intentionally skipped
    return out


def _coerce_scalar(value: Any, target: str) -> tuple[Any, list[str]]:
    """Coerce a parsed spec value to the target schema type. Returns (value, issues)."""
    issues: list[str] = []
    if value is None:
        return None, issues
    if target in ("string", "markdown", "text", "url", "image"):
        if isinstance(value, list):
            joined = "\n".join(str(v) for v in value).strip()
            return joined or None, issues
        s = _strip_quotes(str(value)).strip()
        return s or None, issues
    if target == "number":
        s = _strip_quotes(str(value)).strip()
        try:
            return int(s) if re.fullmatch(r"-?\d+", s) else float(s), issues
        except ValueError:
            issues.append(f"cannot coerce {value!r} to number")
            return None, issues
    if target == "boolean":
        s = _strip_quotes(str(value)).strip().lower()
        if s in ("true", "yes", "1"):
            return True, issues
        if s in ("false", "no", "0"):
            return False, issues
        issues.append(f"cannot coerce {value!r} to boolean")
        return None, issues
    if target == "array<string>":
        if isinstance(value, list):
            return [_strip_quotes(str(v)).strip() for v in value if str(v).strip()], issues
        return [_strip_quotes(str(value)).strip()], issues
    if target == "array<image>":
        paths = value if isinstance(value, list) else [value]
        cleaned = [str(p).strip() for p in paths if str(p).strip()]
        return cleaned, issues
    return value, issues


def _validate_url(value: str, constraints: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    uri = constraints.get("uri") if constraints else None
    if not uri:
        return issues
    allowed = uri.get("scheme") or []
    try:
        from urllib.parse import urlparse

        parsed = urlparse(value)
        if allowed and parsed.scheme not in allowed:
            issues.append(
                f"URL scheme {parsed.scheme!r} not in allowed {allowed}"
            )
    except Exception:
        issues.append(f"invalid URL: {value!r}")
    return issues


def normalize_and_validate(
    parsed_fields: dict[str, Any],
    schema: dict[str, Any],
) -> tuple[dict[str, Any], list[str], list[str]]:
    """Map parsed-spec values to the discovered schema deterministically.

    Returns (payload, uncertain_fields, errors). The payload carries the
    schema field values plus the alt pseudo-fields for images and the
    `__markdownDir__` reserved key, set later by the orchestrator.
    """
    writable = _writable_field_types(schema)
    field_lookup = {f.get("name"): f for f in schema.get("fields", [])}
    payload: dict[str, Any] = {}
    uncertain: list[str] = []
    errors: list[str] = []

    for name, target in writable.items():
        if name not in parsed_fields:
            continue
        raw = parsed_fields[name]
        coerced, issues = _coerce_scalar(raw, target)
        errors.extend(f"{name}: {i}" for i in issues)
        if coerced is None:
            continue
        payload[name] = coerced

    # alt pseudo-fields: pass through if the parser saw them.
    for img_name, alt_name in IMAGE_ALT_PSEUDO_FIELDS.items():
        if alt_name in parsed_fields:
            val = parsed_fields[alt_name]
            if IMAGE_ALT_PSEUDO_FIELDS[img_name].endswith("s"):  # screenshots alt is a list
                payload[alt_name] = val if isinstance(val, list) else [val]
            else:
                payload[alt_name] = _strip_quotes(str(val)).strip() or None

    # Validate required + constraints per discovered schema.
    for f in schema.get("fields", []):
        name = f.get("name")
        if name in ("title", "slug", "published"):
            continue
        if name not in writable:
            continue
        constraints = f.get("constraints") or {}
        val = payload.get(name)
        if constraints.get("required") and (val is None or (isinstance(val, str) and not val.strip())):
            errors.append(f"{name}: required but missing or empty")
        if val is None:
            continue
        if constraints.get("uri"):
            errors.extend(f"{name}: {i}" for i in _validate_url(str(val), constraints))
        if constraints.get("integer") and not isinstance(val, int):
            try:
                if float(val) != int(float(val)):
                    errors.append(f"{name}: expected integer, got {val!r}")
            except (TypeError, ValueError):
                errors.append(f"{name}: expected integer, got {val!r}")
        if "min" in constraints and val is not None:
            try:
                if float(val) < float(constraints["min"]):
                    errors.append(f"{name}: below minimum {constraints['min']}")
            except (TypeError, ValueError):
                pass

    return payload, uncertain, errors


# ── LLM self-repair fallback (1 retry) ──


def _build_payload_pydantic_model(schema: dict[str, Any]) -> type[BaseModel]:
    """Build a Pydantic model from the discovered schema so the LLM's structured
    output can ONLY express the writable schema fields (no hallucinated keys)."""
    writable = _writable_field_types(schema)
    fields: dict[str, Any] = {}
    for name, target in writable.items():
        if target in ("string", "markdown", "text", "url", "image"):
            py = Optional[str]
        elif target == "number":
            py = Optional[float]
        elif target == "boolean":
            py = Optional[bool]
        elif target == "array<string>":
            py = Optional[list[str]]
        elif target == "array<image>":
            py = Optional[list[str]]
        else:
            continue
        fields[name] = (py, None)
    for alt_name in IMAGE_ALT_PSEUDO_FIELDS.values():
        py = Optional[list[str]] if alt_name.endswith("s") else Optional[str]
        fields[alt_name] = (py, None)
    return create_model("ProjectPayload", **fields)


def _llm_repair(
    parsed_fields: dict[str, Any],
    schema: dict[str, Any],
    errors: list[str],
) -> tuple[dict[str, Any], list[str]]:
    """One self-repair retry: feed the deterministic validation errors back to
    the model with a constrained-output schema. The model may only emit fields
    that exist on the discovered project schema. Returns (payload, new_errors).
    """
    model_cls = _build_payload_pydantic_model(schema)
    repair_llm = ChatOllama(
        base_url=OLLAMA_URL,
        model=OLLAMA_MODEL,
        temperature=0,
    ).with_structured_output(model_cls)

    writable = _writable_field_types(schema)
    schema_brief = json.dumps(
        [
            {"name": n, "type": t}
            for n, t in writable.items()
        ],
        indent=2,
    )

    instruction = (
        "You are a deterministic schema-aware mapper. The user's spec already "
        "produced these raw parsed values, but type validation failed. Re-emit "
        "ONLY the schema fields below, copying spec values verbatim and coercing "
        "types correctly. Do NOT rewrite, summarize, or invent content. Leave a "
        "field blank if the spec does not provide it.\n\n"
        f"Discovered writable schema fields:\n{schema_brief}\n\n"
        f"Raw parsed spec values:\n{json.dumps(parsed_fields, indent=2, default=str)}\n\n"
        f"Validation errors to fix:\n" + "\n".join(f"- {e}" for e in errors)
    )
    try:
        result = repair_llm.invoke(instruction)
        payload = {k: v for k, v in result.model_dump().items() if v is not None}
    except Exception as exc:  # noqa: BLE001
        return {}, [f"LLM self-repair failed: {exc}"]

    # Re-validate deterministically to catch lingering issues.
    _, _, new_errors = normalize_and_validate(payload, schema)
    return payload, new_errors


# ── Pending-create slot for the human confirmation gate ──


_PENDING_CREATE: dict[str, Any] = {}


@tool
def create_project_from_spec(
    spec_path: Annotated[str, "Path to the Markdown specification file"],
) -> str:
    """Spec-driven project creation. Reads the spec, discovers the Sanity
    project schema, deterministically maps spec fields to schema fields,
    validates, and (if needed) attempts ONE LLM self-repair retry. Does NOT
    write to Sanity — stashes the proposed payload for human confirmation.
    Reply `yes` to the agent afterwards to call confirm_pending_create()."""
    raw_parse = parse_spec_file.invoke({"path": spec_path})
    try:
        parsed_json = json.loads(raw_parse)
    except (json.JSONDecodeError, TypeError):
        return raw_parse

    if "fields" not in parsed_json:
        return raw_parse if isinstance(raw_parse, str) else json.dumps(parsed_json)

    try:
        schema = get_discovered_schema()
    except Exception as exc:  # noqa: BLE001
        return f"Error discovering schema: {exc}"

    parsed_fields = parsed_json["fields"]
    payload, uncertain, errors = normalize_and_validate(parsed_fields, schema)

    repair_errors: list[str] = []
    if errors:
        payload, repair_errors = _llm_repair(parsed_fields, schema, errors)
        errors = repair_errors

    if errors:
        return (
            "Validation failed after self-repair; NOT staging a create.\n"
            f"Errors:\n" + "\n".join(f"- {e}" for e in errors)
            + "\n\nPlease fix the spec and retry."
        )

    # title + slug + published are required meta fields stored at the top level.
    title = parsed_fields.get("title")
    slug = parsed_fields.get("slug")
    slug_clean = _strip_quotes(str(slug)).strip() if slug is not None else None
    if not title:
        return "Error: spec is missing `- **title**: <value>` (required)."
    if not slug_clean:
        return r"Error: spec is missing `- **slug**: `<value>`` (required)."
    if len(slug_clean) > 96 or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?", slug_clean):
        return (
            f"Error: slug {slug_clean!r} must be lowercase, URL-safe, "
            "1-96 chars, not start/end with a hyphen."
        )

    payload["title"] = str(title)
    payload["slug"] = slug_clean
    payload["published"] = True  # per decision: spec-created projects go live
    payload["__markdownDir__"] = parsed_json["source_dir"]

    global _PENDING_CREATE
    _PENDING_CREATE = {
        "payload": payload,
        "spec_path": parsed_json["spec_path"],
        "spec_sha256": parsed_json["spec_sha256"],
        "schema_version_hash": schema.get("_version_hash"),
        "source_dir": parsed_json["source_dir"],
        "uncertain_fields": uncertain,
        "provenance": parsed_json["provenance"],
        "staged_at": datetime.now(timezone.utc).isoformat(),
    }

    return json.dumps(
        {
            "status": "pending_confirmation",
            "message": "Proposed project payload staged. Reply `yes` to create, "
            "or describe what to change.",
            "payload": payload,
            "uncertain_fields": uncertain,
            "provenance": parsed_json["provenance"],
        },
        indent=2,
    )


@tool
def confirm_pending_create() -> str:
    """Confirm and execute the staged spec-driven project create. Writes the
    project to Sanity (via create_project) and an audit record to .agents/."""
    global _PENDING_CREATE
    if not _PENDING_CREATE:
        return "Error: no pending create to confirm. Run create_project_from_spec(<path>) first."

    pending = _PENDING_CREATE
    payload = dict(pending["payload"])

    # Hand off to the existing create_project tool (so the create path,
    # image uploads, slug-existence check, etc. are reused verbatim).
    create_result = create_project.invoke({"project_data": payload})
    _PENDING_CREATE = {}

    # Audit log (always, on the same turn as the create attempt).
    audit_dir = PROJECT_ROOT / ".agents"
    audit_dir.mkdir(parents=True, exist_ok=True)
    slug = payload.get("slug", "unknown")
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    audit_path = audit_dir / f"spec-{slug}-{ts}.json"
    audit_record = {
        "spec_path": pending.get("spec_path"),
        "spec_sha256": pending.get("spec_sha256"),
        "schema_version_hash": pending.get("schema_version_hash"),
        "source_dir": pending.get("source_dir"),
        "mapped_payload": payload,
        "uncertain_fields": pending.get("uncertain_fields", []),
        "provenance": pending.get("provenance", {}),
        "staged_at": pending.get("staged_at"),
        "create_result": create_result,
    }
    try:
        audit_path.write_text(json.dumps(audit_record, indent=2, default=str), encoding="utf-8")
    except OSError as exc:
        return f"{create_result}\n(Warning: failed to write audit log: {exc})"

    return f"{create_result}\nAudit log: {audit_path}"


@tool
def cancel_pending_create() -> str:
    """Discard the staged spec-driven project payload without writing to Sanity."""
    global _PENDING_CREATE
    _PENDING_CREATE = {}
    return "Pending create cancelled. Nothing was written to Sanity."


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

# ── LLM setup ────────────────────────────────────────────

SYSTEM_PROMPT = """You are a portfolio management assistant. Your job is to help the user
manage projects on their Sanity CMS portfolio website. You support the full project
lifecycle: create, read, update, publish, unpublish, and delete — all through natural
language.

Available tools (read-only):
- read_file(path) — read a file from disk
- find_markdown(directory) — find .md files in a directory
- list_dir(path) — list directory contents
- list_projects(search?) — search portfolio projects by name, or list all
- read_project(slug) — read a single project's full data

Available tools (mutations — each is a distinct lifecycle operation):
- create_project(data) — CREATE a brand new project (fails if slug exists)
- update_project(slug, data) — UPDATE specific fields of an existing project (fails if slug not found; partial patch — only fields you provide are changed)
- publish_project(slug) — PUBLISH an existing project (sets it visible on public site)
- unpublish_project(slug) — UNPUBLISH an existing project (hides it from public site)
- delete_project(slug) — DELETE a project and its documentation pages forever

Available tools (narrative publishing — Markdown docs → project.content):
- publish_docs(slug, docs_dir) — deterministically serialize every Markdown
  document in the project's `docs/` directory into Portable Text and write it
  to project.content (a replace with stable keys). The Markdown documents are
  the source of truth; the agent never rewrites them. Metadata is untouched.
  Call this when the user asks to publish/refresh a project's narrative
  documentation or points at a docs/ directory.

Available tools (indexing — keep Qdrant in sync with Sanity):
- reindex_content() — transactionally rebuild the semantic search index from
  Sanity (temporary collection → validate → atomic promote → cleanup).
  Call it AFTER any successful content mutation so search reflects the new state.

Available tools (dataset synchronization — replace an entire dataset):
- sync_production_to_local() — pull production down into the local dev dataset (overwrites local)
- sync_local_to_production() — promote local dev up to production (overwrites production; destructive)

Available tools (spec-driven creation — `<path> add project considering this spec`):
- parse_spec_file(path) — deterministically extract fields from a Markdown spec
- describe_project_schema() — discover the live Sanity `project` schema (cached)
- create_project_from_spec(spec_path) — orchestrate parse → schema → validate → stage
- confirm_pending_create() — write the staged project to Sanity (after the user says yes)
- cancel_pending_create() — discard the staged payload

CRITICAL: Each operation has its OWN dedicated tool. Do NOT use one tool as a
substitute for another. Read the intent carefully and pick the correct tool.

After any successful content mutation (create_project, update_project,
publish_project, unpublish_project, delete_project), call reindex_content()
so the semantic search index stays in sync with Sanity. The indexing itself is
transactional — production search is never interrupted or partially rebuilt.

── SPEC-FILE WORKFLOW (mapper, not author) ──────────────

When the user says "<file_path> add project considering this spec" (or any
request that provides a spec file path and asks to add a project):

1. Call create_project_from_spec(<file_path>). It does ALL of:
   - parses the spec deterministically,
   - discovers the current Sanity project schema,
   - maps spec fields to schema fields (types coerced),
   - validates against the discovered schema (with ONE LLM self-repair retry
     if validation fails),
   - stages the proposed payload and returns it for confirmation.
   Do NOT call parse_spec_file or describe_project_schema separately before it
   — the orchestrator calls them internally.

2. Show the user the proposed payload, any uncertain_fields, and the provenance
   (which spec line each field came from). Ask them to confirm.

3. If the user replies `yes` (or clearly confirms): call confirm_pending_create().
   This writes the project to Sanity and an audit record to .agents/.

4. If the user asks to change something: ask them to edit the spec and re-run,
   or to issue a normal update_project(<slug>, <partial data>) call afterwards.
   Call cancel_pending_create() to discard the staged payload.

Hard rules for the spec-file workflow:
- NEVER rewrite, summarize, improve wording, or invent content. The spec is the
  single source of content; the Sanity schema is the single source of structure.
- The agent is a schema-aware MAPPER, not an author. Copy spec values verbatim;
  only type coercion is permitted.
- Slug MUST come from the spec (``- **slug**: `value` ``). Auto-derive nothing.
- If a required field is missing from the spec, ask the user rather than guess.
- If the slug already exists in Sanity, create_project_from_spec will fail —
  tell the user to use update_project instead.
- Image paths in the spec MUST be absolute. Relative paths are rejected.

── INTENT → OPERATION MAPPING ─────────────────────────────

User says "Create", "Add", "Make a new project", "Publish this" (when providing new content)
  → This is CREATE. Call create_project(data) with all the project data extracted.
    Do NOT call publish_project() — that is for toggling visibility on an existing project.
    Do NOT call update_project() — that is for modifying an existing project.
    create_project will fail if the slug already exists.

User says "Update X", "Change the Y of Z", "Modify", "Replace the Results section",
"Edit the approach section", "Change the cover image"
  → This is UPDATE.
    1. First call list_projects() with a search term to find the project's slug.
       If the name is ambiguous, show options and ask the user to clarify.
    2. Call read_project(slug) to see the current data.
    3. Build a partial data object with ONLY the fields to change.
    4. Call update_project(slug, data). Do NOT include fields that stay the same.
    5. update_project does a true partial patch — only the fields you provide are changed.

User says "Publish X", "Make X visible", "Put X live" (about an EXISTING project)
  → This is PUBLISH (toggle visibility ON).
    1. First call list_projects() with a search term to find the slug.
       If ambiguous, show options and ask.
    2. Call publish_project(slug). This sets the project as visible on the public site.
    3. Do NOT call create_project or update_project — this is a visibility toggle.

User says "Unpublish X", "Hide X", "Take X down", "Make X private" (about an EXISTING project)
  → This is UNPUBLISH (toggle visibility OFF).
    1. First call list_projects() with a search term to find the slug.
       If ambiguous, show options and ask.
    2. Call unpublish_project(slug). This hides the project from the public site.
    3. Do NOT call create_project, update_project, or publish_project.
       Unpublish is its own dedicated operation.

User says "Delete X", "Remove X", "Delete the Y project", "Get rid of X"
  → This is DELETE.
    1. First call list_projects() with a search term to find the slug.
       If ambiguous, show options and ask.
    2. Call delete_project(slug). This permanently removes the project and all its
       documentation pages.

User says "List projects", "What projects do I have?", "Show me my projects"
  → This is LIST. Call list_projects() with no arguments.

User says "Read X", "Show me X", "What's in X", "Get the data for X"
  → This is READ. Call read_project(slug).

── NARRATIVE DOCUMENTATION (Markdown docs → project.content) ────────────

User says "Publish the docs", "Refresh the docs for X", "Publish the narrative
for X from <path>/docs", "Update the documentation content", or points at a
project's docs/ directory
  → This is publish_docs.
    1. First call list_projects() with a search term to find the project's slug.
       If ambiguous, show options and ask.
    2. Call publish_docs(slug, <docs_dir>) where <docs_dir> is the absolute path
       to the project's Markdown documentation directory.
    The tool deterministically serializes each .md document to Portable Text and
    replaces project.content. Metadata is never touched by this operation.
    This is DISTINCT from update_project: update_project edits metadata fields,
    while publish_docs replaces the narrative. Do NOT use update_project to try
    to write narrative content, and do NOT expect publish_docs to change metadata.

── DATASET SYNCHRONIZATION ─────────────────────────────

User says "Sync production to local", "Update my local dataset from production",
"Pull the latest production changes", "Refresh my local dataset",
"Get the latest from prod", "Re-sync local"
  → This is PULL (production → local). Call sync_production_to_local().
    No slug is needed — this replaces the ENTIRE local dataset with production.

User says "Sync local to production", "Publish my local changes to production",
"Promote development to production", "Deploy my portfolio content",
"Push local to prod", "Ship local edits"
  → This is PUSH (local → production). Call sync_local_to_production().
    No slug is needed — this replaces the ENTIRE production dataset.
    IMPORTANT: This is a dataset-level operation, NOT the same as publish_project().
    - publish_project(slug) toggles visibility of ONE project.
    - sync_local_to_production() replaces the WHOLE production dataset (destructive).
    Do not call publish_project() for "deploy"/"promote"/"ship my portfolio" requests.

── SCHEMA FIELDS (for create_project and update_project) ──

These are the metadata fields the metadata create/update path can write. The
narrative (long-form storytelling) is authored as Markdown documents in the
project's docs/ directory and published via publish_docs(slug, docs_dir); it is
NOT part of create_project/update_project.

- title (string): Project name.
- slug (string): URL-friendly identifier.
- shortSummary (markdown): 1-3 sentence summary.
- coverImage (string): Relative path to cover image.
- coverImageAlt (string): Alt text for cover image.
- technologies (array of strings): Tech stack.
- keyMetrics (array of strings): Outcomes and metrics.
- githubUrl (string): Repository URL.
- demoUrl (string): Live demo URL.
- featured (boolean): Whether to feature on homepage (default true).
- displayOrder (number): Sort order (default 0).
- screenshots (array of strings): Relative paths to screenshots.
- screenshotAlts (array of strings): Alt texts for screenshots.

Image paths must be preserved exactly as they appear in the markdown."""


def create_agent():
    llm = ChatOllama(
        base_url=OLLAMA_URL,
        model=OLLAMA_MODEL,
        temperature=0,
    ).bind_tools(tools)

    # ── Graph ────────────────────────────────────────────
    graph_builder = StateGraph(MessagesState)

    def chatbot(state: MessagesState):
        return {"messages": [llm.invoke(state["messages"])]}

    graph_builder.add_node("chatbot", chatbot)
    graph_builder.add_node("tools", ToolNode(tools))

    graph_builder.add_conditional_edges(
        "chatbot", tools_condition, {"tools": "tools", "__end__": "__end__"}
    )
    graph_builder.add_edge("tools", "chatbot")
    graph_builder.set_entry_point("chatbot")

    return graph_builder.compile(checkpointer=MemorySaver())


# ── REPL ─────────────────────────────────────────────────


def main():
    agent = create_agent()
    thread_id = "1"

    print(f"Portfolio Publishing Agent ({OLLAMA_MODEL})")
    print("Type your request in natural language, or /quit to exit.")
    print()

    while True:
        try:
            user_input = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not user_input:
            continue
        if user_input.lower() in ("/quit", "/exit", "/q"):
            break
        if user_input.lower() == "/reset":
            thread_id = str(int(thread_id) + 1)
            print("Conversation reset.\n")
            continue

        config = {"configurable": {"thread_id": thread_id}}
        messages = [SystemMessage(content=SYSTEM_PROMPT), ("human", user_input)]

        for event in agent.stream({"messages": messages}, config):
            for node, value in event.items():
                if node == "chatbot":
                    msg = value["messages"][-1]
                    if msg.content:
                        print(msg.content)
                elif node == "tools":
                    for msg in value["messages"]:
                        if isinstance(msg, ToolMessage):
                            print(f"  [{msg.name}] {msg.content[:200]}{'…' if len(msg.content) > 200 else ''}")
        print()


if __name__ == "__main__":
    main()
