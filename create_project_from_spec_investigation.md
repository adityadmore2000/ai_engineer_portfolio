# Investigation: `create_project_from_spec` and directory-of-docs feasibility

Scope: read-only analysis of the spec-driven project creation pipeline. No code
was modified. All conclusions are traced to `agent/publish_agent.py`,
`scripts/describe-schema.ts`, `scripts/create-project.ts`, and
`scripts/publish-tool.ts`.

---

## 1. Implementation location

Everything lives in one Python file plus three TypeScript support files.

### Python agent — `agent/publish_agent.py`

| Symbol | Lines | Role |
|--------|-------|------|
| `SPEC_MAX_CHARS` | 38 | Context-window guard, default 30000 |
| `read_file` (tool) | 59–65 | Reads any file (not used by the spec pipeline) |
| `find_markdown` (tool) | 68–79 | Recursively finds `.md` files (not used by the spec pipeline) |
| `list_dir` (tool) | 82–91 | Lists directory entries (not used by the spec pipeline) |
| `create_project` (tool) | 132–169 | Final Sanity write; used by `confirm_pending_create` |
| `_BULLET_RE` / `_SUBBULLET_RE` / `_ABSENT_PREFIXES` | 344–346 | Parser grammar |
| `_is_absent` | 349–355 | Detects "Not set - …" markers |
| `_strip_quotes` | 358–364 | Strips quoting/backticks from values |
| `parse_spec_text` | 367–446 | **Deterministic Markdown bullet parser** (no LLM) |
| `_enforce_absolute_image_paths` | 452–466 | Rejects relative image paths |
| `parse_spec_file` (tool) | 469–508 | File loader + size guard + parser entry point |
| `_schema_needs_refresh` / `_refresh_schema_cache` / `get_discovered_schema` | 514–550 | mtime-keyed schema cache |
| `describe_project_schema` (tool) | 553–566 | Returns cached schema as JSON |
| `_writable_field_types` | 582–600 | Maps schema fields → writable, typed fields |
| `_coerce_scalar` | 603–637 | Deterministic type coercion |
| `_validate_url` | 640–656 | URI scheme validation |
| `normalize_and_validate` | 659–722 | Coerce + validate against discovered schema |
| `_build_payload_pydantic_model` | 728–750 | Dynamic Pydantic model for LLM self-repair |
| `_llm_repair` | 753–796 | **The only LLM call in the pipeline** (1 retry) |
| `_PENDING_CREATE` | 802 | Global staging slot |
| `create_project_from_spec` (tool) | 805–884 | **Orchestrator** — ties it all together |
| `confirm_pending_create` (tool) | 887–925 | Writes to Sanity + audit log |
| `cancel_pending_create` (tool) | 928–933 | Discards staged payload |
| `tools` list | 936–960 | Tool registration |
| `SYSTEM_PROMPT` spec workflow | 1007–1041 | Prompt section teaching the LLM when to call the orchestrator |
| `main` REPL | 1161–1198 | Reads user input, streams graph |

### TypeScript support

- `scripts/describe-schema.ts` — `createMockRule` (41–56), `runValidation`
  (65–75), `interpretConstraints` (90–135), `extractField` (150–191), `main`
  (207–222). Imports `project` from `sanity/schemaTypes/project.ts` (line 20),
  executes each field's `validation` fn against a proxy that records calls,
  prints normalized JSON. Invoked by `_refresh_schema_cache`
  (`agent/publish_agent.py:523-544`).
- `scripts/create-project.ts` — bridge called by `create_project` tool. Honors
  a `__markdownDir__` key in the payload (lines 26–30) so image paths resolve
  against the spec's directory instead of the temp JSON's directory.
- `scripts/publish-tool.ts` — `setGenericFields` (74–83), `META_KEYS` (66–72),
  `uploadImage` (105–144), `createProject` (314–354). This is the only layer
  that touches Sanity.

### Callers

1. **User command** (REPL input) → LLM routes to `create_project_from_spec`
   based on `SYSTEM_PROMPT` (1009–1041: "*<file_path> add project considering
   this spec*").
2. `create_project_from_spec` calls `parse_spec_file.invoke(...)`
   (line 814) and `get_discovered_schema()` (line 824).
3. `confirm_pending_create` calls `create_project.invoke(...)` (line 900) and
   writes the audit record to `.agents/spec-<slug>-<timestamp>.json` (908–925).
4. `_llm_repair` calls the Ollama `ChatOllama` model (763–767) — the only model
   invocation.

There are no other callers. `parse_spec_file` and `describe_project_schema`
are registered as tools (955–956) but the system prompt instructs the LLM NOT
to call them separately (1019–1020) — the orchestrator calls them internally.

---

## 2. Current approach

### Inputs accepted

A **single path to a Markdown (`.md`) file**. The tool signature is:

```python
def create_project_from_spec(
    spec_path: Annotated[str, "Path to the Markdown specification file"],
) -> str
```
(`agent/publish_agent.py:805-808`)

`parse_spec_file` rejects anything that is not a `.md` file
(484–485: `"Error: only Markdown (.md) specs are supported in v1"`) and any
path that doesn't exist (482–483).

### How the Markdown is loaded

`parse_spec_file` reads the **entire file** into memory with a single call:

```python
md_text = p.read_text(encoding="utf-8")
if len(md_text) > SPEC_MAX_CHARS:  # refuse
```
(`agent/publish_agent.py:487-492`)

### Parsed before reaching the LLM? Chunking? Preprocessing?

The file is **fully parsed deterministically before any LLM is involved**:

1. `parse_spec_text(md_text)` (367–446) walks the text line by line with the
   regex `^-\s+\*\*([^*]+)\*\*:\s?(.*)$` (`_BULLET_RE`, line 344). It extracts
   only `- **field**: value` bullets (plus indented prose/sub-bullet blocks)
   into a `fields` dict and a `provenance` map of field → 1-indexed line number.
   Everything else (headings, prose not under a bullet) is **ignored**.
2. `_enforce_absolute_image_paths` (452–466) emits warnings for relative image
   paths (fields are dropped).
3. The result is returned as JSON:
   `{source_dir, spec_path, raw_length, fields, provenance, warnings, spec_sha256}`
   (497–507).
4. `normalize_and_validate` (659–722) then deterministically maps the parsed
   fields onto the discovered schema, coercing types and checking constraints.

**There is no chunking.** The entire file is read at once, parsed in one pass.
**There is no LLM preprocessing** — the LLM never sees the raw markdown on the
happy path (see §3).

### Where `SPEC_MAX_CHARS` is enforced, and why

Only in `parse_spec_file`:

```python
if len(md_text) > SPEC_MAX_CHARS:
    return (f"Error: spec is {len(md_text)} chars, exceeds SPEC_MAX_CHARS=…")
```
(`agent/publish_agent.py:488-492`)

It guards the *total decoded character count of the single file*. It was
introduced to protect the model's context window — see the comment at
36–38 ("protects the model's context window"). Importantly, on the happy path
the raw spec never reaches the model, so the limit is really protecting the
**self-repair path** (`_llm_repair`, which feeds parsed values back into the
model) and the REPL's tool-message size, plus it bounds the parser's worst
case. The error message even suggests "Split the spec or raise
SPEC_MAX_CHARS" (491).

### Step-by-step pipeline

```
user: "<path> add project considering this spec"
  │
  ▼
LLM (REPL orchestrator) selects create_project_from_spec(spec_path)     [prompt: 1009-1041]
  │
  ▼
create_project_from_spec(spec_path)                                     [805-884]
  │  1. parse_spec_file.invoke({"path": spec_path})                     [814]
  │        → existence + .md check, SPEC_MAX_CHARS check               [481-492]
  │        → parse_spec_text → fields + provenance                     [367-446]
  │        → absolute-image-path warnings                              [452-466]
  │        → JSON {source_dir, fields, provenance, warnings, sha256}   [497-507]
  │  2. get_discovered_schema()                                        [824]
  │        → mtime-keyed cache of scripts/describe-schema.ts output    [514-550]
  │  3. normalize_and_validate(fields, schema)                         [829]
  │        → coerce types, check required/uri/integer/min              [603-722]
  │  4. if errors: _llm_repair(fields, schema, errors)                 [832-834]
  │        → ONE structured-output LLM call, constrained to schema     [753-796]
  │        → re-run normalize_and_validate on the result               [795]
  │  5. if still errors → return errors, nothing staged                [836-841]
  │  6. validate title/slug meta fields                                [843-855]
  │  7. set title, slug, published=True, __markdownDir__               [857-860]
  │  8. stage _PENDING_CREATE with payload + provenance + audit keys   [862-872]
  │  9. return staged payload JSON for human review                    [874-884]
  │
  ▼
user replies "yes" → confirm_pending_create()                          [887-925]
  │  create_project.invoke({project_data: payload})                    [900]
  │     → writes temp JSON, shells out to scripts/create-project.ts    [153-167]
  │     → createProject(input, markdownDir) in publish-tool.ts         [314-354]
  │        → slug-existence check, image uploads, client.create(doc)   [323-352]
  │  audit record → .agents/spec-<slug>-<timestamp>.json               [908-925]
```

---

## 3. Model context — what is actually sent to the model

The pipeline is the **"parse first"** variant, not "pass the raw file to the
LLM":

```
spec.md
  │
read_file() + regex parse_spec_text()          (deterministic, no LLM)
  │
structured {fields, provenance, warnings} JSON
  │
normalize_and_validate() → payload
  │
(only on failure) _llm_repair() ← LLM receives the PARSED JSON, not markdown
```

The model is involved in exactly two places:

1. **REPL orchestrator LLM** (`ChatOllama` bound with tools, 1134–1138): sees
   the system prompt + tool descriptions + user message. It selects the tool
   and reads the *tool result* (the staged payload JSON, 874–884). It never
   receives the spec file's raw text.
2. **Self-repair LLM** (`_llm_repair`, 753–796): only when deterministic
   validation fails. The `instruction` string (778–787) contains:
   - the discovered writable schema brief,
   - `json.dumps(parsed_fields, ...)` — the **already-parsed field dict**,
     not the raw markdown,
   - the validation errors.
   Output is constrained to the dynamic Pydantic model
   (`_build_payload_pydantic_model`, 728–750) so it can only emit writable
   schema fields.

So on the happy path the LLM **never sees the spec**. The `SPEC_MAX_CHARS`
limit is therefore not a first-class model-context limit on the happy path —
but it bounds the data that *would* flow through `_llm_repair` and the parser.

---

## 4. Directory-based input evaluation

Target command:

```
publish project portfolio-agent using docs/

docs/
  overview.md
  architecture.md
  engineering-decisions.md
  challenges.md
  results.md
  faq.md
```

### Would the current implementation understand this with minimal changes?

**No — not for narrative docs.** Two blockers:

1. `parse_spec_file` takes one path and rejects anything whose suffix isn't
   `.md`; a directory path has no `.md` suffix and fails the existence/suffix
   checks (481–485). A directory would need a new "read all `.md` under this
   dir" loader.
2. More fundamentally, the parser only understands the rigid
   `- **field**: value` bullet grammar (`_BULLET_RE`, 344). Narrative docs
   with headings like `## Architecture` and prose paragraphs match **no**
   bullets, so `parse_spec_text` would return an empty `fields` dict. The
   deterministic happy path would fail; the LLM self-repair path would be
   invoked on an empty dict, and the system prompt's hard rule is "the agent is
   a mapper, never an author" (1034–1036).

### Would concatenating all Markdown files work?

Only if **every file still uses the bullet grammar**. The parser is field-keyed
and ignores headings, so a concatenation of several bullet-grammar files
parses exactly like a single file. For narrative/prose docs it produces nothing.

### Would ordering need to be defined?

Yes, two senses:

- **File order** for concatenation must be deterministic (sorted by name, or a
  manifest order). The parser's output is a dict keyed by field name, so file
  order only matters if the **same field appears in more than one file**
  (dict insertion order → last occurrence wins, and provenance would point at
  the last line). A collision policy is needed.
- **Provenance** (field → line number, 388/416/433/443) becomes file + line;
  the current `provenance` maps to line numbers only, so provenance would need
  an offset or file qualifier to stay meaningful.

### Would section boundaries be preserved?

No. The parser discards all structure except bullets. A heading like
`## Engineering Decisions` carries no meaning to it. Preserving
file/section → field associations would require either (a) the docs to contain
`- **engineeringDecisions**: …` bullets (self-describing), or (b) a new
header→schema-field mapping table — which the current schema-agnostic design
explicitly avoids.

### Would the prompt become more reliable or less reliable?

- **Bullet-grammar docs in a folder:** reliability is unchanged — still fully
  deterministic, field-keyed. The only risk is `SPEC_MAX_CHARS` applying to the
  *combined* content, so large folders can silently hit the cap.
- **Narrative docs:** reliability *drops*, because the deterministic path
  cannot work and the fallback would lean on the LLM — reversing the core
  design stance (determinism-first, AGENTS.md "Determinism stance").

### Existing tools that could help

The agent already has `find_markdown(directory)` (68–79) and `read_file(path)`
(59–65), but they are generic read tools; nothing in the spec pipeline uses
them.

---

## 5. Alternative approaches

### Option A — Single large Markdown file (status quo)

**Pros**
- Works today, zero changes.
- Fully deterministic, field-keyed, per-field line-number provenance.
- One source of truth, no ordering concerns.
- `SPEC_MAX_CHARS` gives a hard, obvious failure signal.

**Cons**
- Not modular — docs grow into one unmaintainable blob.
- Hard size ceiling (30000 chars default) forces `SPEC_MAX_CHARS` bumps or manual splitting.
- No reusability across projects (architecture/engineering sections can't be shared).
- No structure; everything in one flat file.

### Option B — Folder of Markdown files

**Pros**
- Modular and maintainable; each concern lives in its own file (matches the
  example `docs/` layout).
- Scales naturally as docs grow; new files slot in without touching one giant doc.
- Minimal-change path: a loader that concatenates bullet-grammar files (sorted
  or manifest-ordered) feeds the existing parser untouched.

**Cons**
- Ordering must be defined (sort order or explicit list); collision policy for
  repeated fields needed.
- Provenance must become file+line.
- `SPEC_MAX_CHARS` becomes a combined-content cap.
- If the docs are narrative prose instead of bullet grammar, the deterministic
  pipeline cannot map them — needs an LLM path or a header→field map, both of
  which conflict with the current design.

### Option C — Folder with a manifest (e.g., `manifest.yaml`)

**Pros**
- Explicit, declarative ordering and section→field/file mapping; provenance is
  file+line by construction.
- Deterministic and auditable; manifest can hold meta (title, slug, featured)
  and list content files in reading order.
- Best scalability and clarity for large documentation sets.

**Cons**
- New file format to define, parse, and validate (and it must stay in sync with
  the bullet grammar or become a header→field map).
- More moving parts; the parser no longer has a single input.
- Still requires each content file to be machine-parseable (bullet grammar) or
  requires abandoning the deterministic stance for prose.

---

## 6. Recommendation

**Adopt Option B as an extension of the existing architecture, with one hard
condition: files must keep the `- **field**: value` bullet grammar, and Option
C's manifest as the natural next step if prose docs are the goal.**

Rationale against the five priorities:

- **Simplicity / LLM reliability:** The current design's strength is that the
  happy path is deterministic and schema-agnostic (`parse_spec_text` keys off
  `- **field**:` bullets, 344; `normalize_and_validate` maps to the discovered
  schema, 659–722). A directory loader that globs `*.md` (via the existing
  `find_markdown` pattern, 68–79), orders them, concatenates them, and runs the
  same `parse_spec_text` **reuses 100% of the deterministic machinery**. The
  LLM stays out of the happy path, so reliability is unchanged. This is the
  minimal change: a new loader plus provenance made file-aware
  (`parse_spec_file`, 469–508, is the only place that reads a path).
- **Maintainability / scalability / documentation growth:** Option A caps out
  at `SPEC_MAX_CHARS` (38) with no modularity. Option B gives per-concern files
  and unbounded growth (subject to the combined cap, which is a *documentation
  quantity* limit, not a per-file limit).
- **Why not Option C now:** It is the most robust and is the right design once
  docs become genuinely narrative (headings + prose rather than bullet fields).
  But it introduces a manifest format, ordering semantics, and a header→field
  mapping table before there is evidence the folder-of-bullets approach is
  insufficient. It also pushes the system toward an LLM mapping path, which
  contradicts the documented "mapper, never author" stance (AGENTS.md,
  `SYSTEM_PROMPT` 1034–1036).

**Key limitation to record:** the current pipeline is a *field-keyed bullet
parser*, not a *section parser*. It will never understand freeform
`## Architecture` + prose sections without either (a) converting those sections
to `- **theSolution**: …` bullets, or (b) adding an LLM or header-map mapping
step. Any future directory support must decide which of these is intended
*before* implementation — that decision, not the directory itself, is what
determines feasibility.
