"""Spec-driven project creation pipeline.

Owns all logic for turning a Markdown spec into a staged project payload:
parsing, schema discovery, normalization, validation, LLM self-repair,
pending-create state, confirmation, and audit generation.

``publish_agent.py`` tools delegate to this module — they never implement
the workflow directly.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from llm import create_chat_model
from pydantic import BaseModel, ValidationError, create_model

import bridges
from specs import (
    FrontmatterError,
    ProjectMetadata,
    ProjectSpec,
    SectionError,
    detect_canonical,
    extract_sections,
    parse_frontmatter,
    strip_frontmatter,
)
from state import SchemaCache, PendingCreateState

# ── Configuration ────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Maximum characters of extracted spec text the agent will accept before
# refusing (protects the model's context window).  Override via env.
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




# ── Spec parsing ─────────────────────────────────────────
#
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


def _build_canonical_spec(path: Path, text: str, front_meta: dict[str, Any]) -> ProjectSpec:
    """Build a typed ``ProjectSpec`` from a canonical (frontmatter) spec.

    Raises ``ValidationError`` (metadata) or ``SectionError`` (duplicate
    section ids) with deterministic messages; no partial state is produced.
    """
    _, body_md = strip_frontmatter(text)
    metadata = ProjectMetadata(**front_meta)
    sections, extract_warnings = extract_sections(body_md, str(path))
    unknown_meta = sorted((k, v) for k, v in (metadata.model_extra or {}).items())

    warnings = [f"unknown front-matter field: {k} (ignored)" for k, _ in unknown_meta]
    warnings.extend(extract_warnings)
    warnings.extend(_enforce_absolute_image_paths(metadata.model_dump(exclude_unset=True)))

    return ProjectSpec(
        source_path=str(path),
        source_dir=str(path.parent),
        raw_sha256=hashlib.sha256(text.encode("utf-8")).hexdigest(),
        raw_length=len(text),
        format="frontmatter",
        metadata=metadata,
        body_md=body_md,
        sections=sections,
        unknown_meta=unknown_meta,
        warnings=warnings,
    )


def parse_spec_file(path: str) -> str:
    """Deterministically parse a Markdown project spec.

    Detects the canonical ``project-spec.md`` format via a ``---`` frontmatter
    block containing ``schema_version`` and returns JSON adding ``format``,
    ``fields`` (typed metadata dump), ``body_md``, ``sections``, and
    ``body_sha256``. Legacy bullet specs (no canonical front-matter) keep the
    established ``fields``/``provenance`` contract unchanged (transitional).

    On error, returns an error string (not JSON).
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

    try:
        fm_str, _body = strip_frontmatter(md_text)
        front_meta = parse_frontmatter(fm_str)
    except FrontmatterError as exc:
        return f"Error: {exc}"

    if detect_canonical(front_meta):
        try:
            spec = _build_canonical_spec(p, md_text, front_meta)
        except ValidationError as exc:
            return f"Error: invalid project-spec front-matter metadata:\n{exc}"
        except SectionError as exc:
            return f"Error: {exc}"
        body_md = spec.body_md
        unknown_keys = {k for k, _ in spec.unknown_meta}
        fields = {
            k: v
            for k, v in spec.metadata.model_dump(exclude_unset=True).items()
            if k not in unknown_keys
        }
        return json.dumps(
            {
                "source_dir": spec.source_dir,
                "spec_path": spec.source_path,
                "raw_length": spec.raw_length,
                "format": spec.format,
                "fields": fields,
                "provenance": {},
                "warnings": spec.warnings,
                "spec_sha256": spec.raw_sha256,
                "body_md": body_md,
                "sections": [s.model_dump() for s in spec.sections],
                "body_sha256": hashlib.sha256(body_md.encode("utf-8")).hexdigest(),
            },
            indent=2,
        )

    # Legacy bullet adapter — transitional only; removed in Phase 7.
    fields, provenance = parse_spec_text(md_text)
    warnings = _enforce_absolute_image_paths(fields)

    return json.dumps(
        {
            "source_dir": str(p.parent),
            "spec_path": str(p),
            "raw_length": len(md_text),
            "format": "legacy",
            "fields": fields,
            "provenance": provenance,
            "warnings": warnings,
            "spec_sha256": hashlib.sha256(md_text.encode("utf-8")).hexdigest(),
            "body_md": "",
            "sections": [],
            "body_sha256": None,
        },
        indent=2,
    )


# ── Schema discovery (delegated to state.SchemaCache) ──

_schema_cache = SchemaCache(SCHEMA_FILE)


def get_discovered_schema() -> dict[str, Any]:
    return _schema_cache.get()


def describe_project_schema() -> str:
    """Return the discovered project schema as JSON, stripping internal keys."""
    try:
        schema = get_discovered_schema()
    except Exception as exc:  # noqa: BLE001
        return f"Error discovering schema: {exc}"
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
    repair_llm = create_chat_model().with_structured_output(model_cls)

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


# ── Pending-create slot (delegated to state.PendingCreateState) ──

_pending_create = PendingCreateState()


def create_project_from_spec(spec_path: str) -> str:
    """Orchestrate: parse spec → discover schema → validate → (LLM repair) → stage.

    Does NOT write to Sanity. Returns a JSON summary for human confirmation,
    or an error string.
    """
    raw_parse = parse_spec_file(spec_path)
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

    _pending_create.set({
        "payload": payload,
        "spec_path": parsed_json["spec_path"],
        "spec_sha256": parsed_json["spec_sha256"],
        "schema_version_hash": schema.get("_version_hash"),
        "source_dir": parsed_json["source_dir"],
        "uncertain_fields": uncertain,
        "provenance": parsed_json["provenance"],
        "format": parsed_json.get("format", "legacy"),
        "body_md": parsed_json.get("body_md", ""),
        "sections": parsed_json.get("sections", []),
        "body_sha256": parsed_json.get("body_sha256"),
        "staged_at": datetime.now(timezone.utc).isoformat(),
    })

    return json.dumps(
        {
            "status": "pending_confirmation",
            "message": "Proposed project payload staged. Reply `yes` to create, "
            "or describe what to change.",
            "format": parsed_json.get("format", "legacy"),
            "payload": payload,
            "uncertain_fields": uncertain,
            "provenance": parsed_json["provenance"],
        },
        indent=2,
    )


def confirm_pending_create(create_project_fn) -> str:
    """Confirm and execute the staged spec-driven project create.

    Writes the project to Sanity (via *create_project_fn*) and an audit
    record to ``.agents/``.

    Parameters
    ----------
    create_project_fn:
        Callable that accepts ``{"project_data": dict}`` and returns a result
        string.  In practice this is the ``create_project`` LangChain tool's
        ``.invoke`` method.
    """
    if not _pending_create.is_pending:
        return "Error: no pending create to confirm. Run create_project_from_spec(<path>) first."

    pending = _pending_create.get()
    payload = dict(pending["payload"])

    # Hand off to the existing create_project tool (so the create path,
    # image uploads, slug-existence check, etc. are reused verbatim).
    create_result = create_project_fn({"project_data": payload})
    _pending_create.clear()

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


def cancel_pending_create() -> str:
    """Discard the staged spec-driven project payload without writing to Sanity."""
    _pending_create.clear()
    return "Pending create cancelled. Nothing was written to Sanity."
