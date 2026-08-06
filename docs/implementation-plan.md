# Implementation Plan: Metadata / Narrative Separation

Status: **Implementation plan** (no code written yet)
Source of truth:
- [`project-content-architecture.md`](./project-content-architecture.md) — Hybrid model, §4
- [`migration-plan.md`](./migration-plan.md) — 6-step local-first replace rollout

This plan maps the approved architecture onto the existing codebase, sequences
it into reviewable PR-sized tasks, and calls out risks the architecture docs do
not already cover.

---

## 0. Key structural finding

The codebase already contains most of the target infrastructure:
`documentationBlocks.ts`, `DocumentationBlocks.tsx`, `PortableContent.tsx`,
`lib/project-docs-source.ts`, `uploadImage`, and the `projectDocumentationPage`
channel. The work is mostly *reuse + a new deterministic serializer + a data
migration*, matching the architecture doc §4.6.

**Current flat-field read surfaces (must converge on `content`):**

| File | What it reads today |
|------|--------------------|
| `sanity/schemaTypes/project.ts` | schema (metadata + ~18 narrative fields + `detailedContent`) |
| `sanity/types.ts` | `ProjectDetail` flat narrative fields |
| `sanity/queries.ts:102` | `projectBySlugQuery` selects narrative fields |
| `sanity/fallbackContent.ts` | fallback projects carry narrative fields |
| `scripts/publish-tool.ts` | `ProjectPublishInput` / `ProjectReadOutput` / `readProjectQuery` |
| `lib/indexing/types.ts:57` | `projectsQuery` selects 17 flat fields |
| `lib/indexing/adapters.ts` | `fallbackToSanityProject` maps narrative fields |
| `lib/indexing/chunkers.ts` | 14 hard-coded named sections + anchors |
| `lib/retrieval/structured.ts` | `extractProjectFields` reads 11 fields by name |
| `app/projects/[slug]/page.tsx` | hard-coded render order, ~9 bespoke blocks |

---

## 1. Phase-by-phase mapping

### Phase 0 — Foundation & pure refactors (no behavior change)

| File | Gains | Loses |
|---|---|---|
| `lib/content/headings.ts` (new) | canonical `generateHeadingId()` — the single source of truth for heading/anchor ids (slugify + dedup); every consumer (renderer, migration, chunker, doc-page TOC) calls it rather than implementing its own slugification | — |
| `lib/content/portable-text.ts` (new) | **required** shared abstraction: PT→text flatten + heading-block splitter; canonical home for common Portable Text operations, reused by chunker and retrieval (not optional) | — |
| `lib/project-docs-source.ts` | re-uses shared `generateHeadingId()` | private `slugify` (inlined) |
| `lib/indexing/chunkers.ts` | re-uses shared `generateHeadingId()` for anchors | inline `toLowerCase().replace(/\s+/g,"-")` |
| `scripts/lib/upload.ts` (new) | shared `uploadImage` (exported) | — |
| `scripts/publish-tool.ts` | re-imports `uploadImage` | private copy |
| `package.json` | `test` script + runner dep | — |

**Dependencies:** none (pure refactors).
**Complexity:** S each.
**Risks:** `createToc` (`lib/project-docs-source.ts:284`) currently suffixes ids
with `-<8-char _key>`; the shared util must preserve that behavior for doc pages
while later allowing a bare-slug mode for the project page (see Risk R2).

### Phase 1 — Deterministic content tooling (additive)

| File | Gains | Loses |
|---|---|---|
| `lib/content/discover-docs.ts` (new) | recursive `.md` scan, `order` front-matter → filename fallback, per-file/dir size caps, loud malformed-front-matter errors, `[{file, order, heading, raw}]` in deterministic order | — |
| `lib/content/markdown-to-pt.ts` (new) | md→PT serializer: h2/h3/h4, prose, lists, code marks, `documentationCodeBlock`, `documentationMermaidDiagram`, `documentationCallout` (keyword variants), `documentationTable`, `documentationImage`, `faqItem`, `challengeCard`, `- **Q:**`/`- **A:**`, `**Problem/Solution/Outcome:**` triplets; stable content-hash `_key`s; structural validation (balanced fences, closed tables, absolute image paths, size caps); `--check` AST round-trip mode | — |

**Dependencies:** Phase 0 (shared utils, tests).
**Complexity:** L (core new code).
**Risks:** depends on the serializer-engine decision (R3). `documentationImage.alt`
is `Rule.required()` (`documentationBlocks.ts:429`) so the serializer must always
emit alt text (R5).

### Phase 2 — Schema `content` + read surfaces (additive; behavior preserved)

| File | Gains | Loses |
|---|---|---|
| `sanity/schemaTypes/documentationBlocks.ts` | `faqItem`, `challengeCard` object types (thin wrappers over current `faq`/`interestingChallenges` shapes, subfields stay `markdown`); shared `projectPortableTextBlockConfig` constant | — |
| `sanity/schemaTypes/project.ts` | `content: array` of (shared block config + `...documentationBlockTypes` + `faqItem` + `challengeCard`), `Rule.min(1).optional()`, described as "published representation — do not edit" | — (legacy fields stay until Phase 8) |
| `sanity/schemaTypes/index.ts` | registers `faqItem`/`challengeCard` | — |
| `sanity/schemaTypes/projectDocumentationPage.ts` | re-uses shared block config (optional DRY) | duplicated inline block config |
| `sanity/types.ts` | `ProjectDetail.content?: PortableTextBlock[]` (reuse/extend `ProjectDocumentationPage` block types); `Challenge`/`FaqItem` kept for legacy until Phase 8 | — |
| `sanity/queries.ts` | `projectBySlugQuery` also selects `content` | — |
| `scripts/publish-tool.ts` | `ProjectReadOutput`/`readProject` also return `content` | — |
| `sanity/fallbackContent.ts`, `lib/indexing/adapters.ts` | fallback projects gain `content` (or become metadata-only) | — |

**Dependencies:** Phase 1 (block-shape alignment).
**Complexity:** M.

> **Note on `describe-schema.ts` (dropped):** the migration plan §3.5 suggests
> generalizing `describe-schema.ts` to a document-type registry "so `content` and
> its block types are discoverable by the agent." This is **not required** by the
> approved architecture. The discovered schema feeds only the metadata mapping
> path (`normalize_and_validate`, `create_project_from_spec`, LLM self-repair).
> `content` is excluded from `_writable_field_types` (mirroring `detailedContent`),
> and `publish_docs` is a schema-free serializer (architecture doc §3.2/§9.7 —
> "narrative needs no schema knowledge at all"). No consumer needs
> `projectDocumentationPage` discovery (agent has no doc-page tools; plan §11 keeps
> doc pages as-is). Skipping this refactor keeps the change surface smaller.
**Risks:** R4 (`_key` charset), R6 (fallback narrative loss), R7 (`setGenericFields`
defensive exclusion of `content`).

### Phase 3 — `publish-docs` bridge + agent tool

| File | Gains | Loses |
|---|---|---|
| `scripts/publish-docs.ts <slug> <docs-dir>` (new) | discover → serialize → structural validation (+`--check`) → image upload (shared util) → `client.patch(id).set({ content })` (replace with stable keys) | — |
| `agent/publish_agent.py` | `publish_docs(slug, docs_dir)` tool + registration + `SYSTEM_PROMPT` section; explicit `content` exclusion in `_writable_field_types` (mirroring `detailedContent`); stale field lists in `create_project`/`update_project` tool args + prompt refreshed | hard-coded stale narrative field list (`problemStatement`/`approach` etc.) |

**Dependencies:** Phase 1 (tooling), Phase 2 (`content` field), Phase 0 (upload util).
**Complexity:** M (bridge) + S-M (agent).
**Risks:** the prompt field-list regeneration decision (§5.6 says "regenerated
from the live schema or removed in favor of schema discovery") — recommend the
minimal fix (trim stale fields, rely on discovery) to keep this PR small (R8).

### Phase 4 — Data migration (local dataset only)

| File | Gains | Loses |
|---|---|---|
| `scripts/migrate-legacy-content.ts` (new) | raw GROQ read of legacy fields; emits `projects/<slug>/docs/*.md` in current rendered order (overview → architecture → engineering-decisions → challenges → results → demonstrates → examples → lessons-and-limitations → future-improvements → timeline → faq) with `order` front-matter and legacy-anchor-preserving headings (`Why I Built It`, …) whose ids are verified to match the shared `generateHeadingId()`; commits docs; runs the Phase-3 pipeline to populate `content`; prints per-project diff summary | — |
| `projects/<slug>/docs/*.md` (new, committed) | the authored source of truth | — |

**Dependencies:** Phase 3 (`publish-docs`), Phase 1 (serializer).
**Complexity:** M-L.
**Risks:** migration of `architectureImage` must emit `![alt](path)` (alt required,
R5); metadata-only projects intentionally get no docs/ (plan §3.8); the
`projects/` top-level directory is a new repo convention (R9); migrated headings
must resolve to legacy anchors via the shared `generateHeadingId()` so the
emitted `content` stays consistent with the renderer and chunker.

### Phase 5 — Renderer rewrite (behavior change; local verification)

| File | Gains | Loses |
|---|---|---|
| `app/projects/[slug]/page.tsx` | metadata hero (unchanged) + single `<PortableContent value={project.content}/>`; heading `id`s computed via the shared `generateHeadingId()` (bare-slug mode → legacy anchors); metadata-only projects render hero alone — never empty documentation headings, separators, or placeholder spacing; `detailedContent` "Details" section removed | ~9 bespoke blocks (`DetailBlock`/`ImageBlock`/`ChallengesBlock`/`BeforeAfterBlock`/`FaqBlock` usage) |
| `components/DocumentationBlocks.tsx` | `faqItem`/`challengeCard` renderers mapped into `documentationPortableTextComponents` (reusing `ChallengesBlock`/`FaqBlock` card styling) | — |
| `components/PortableContent.tsx` | — (unchanged) | — |

**Dependencies:** Phase 0 (`generateHeadingId()`), Phase 2 (`content`), Phase 4
(local `content` populated so this is verifiable).
**Complexity:** M.
**Risks:** R2 (anchor ids — must emit real scroll targets matching the chunker's
scheme; the *current* page emits no ids at all, so "legacy anchors resolve" is
only satisfied if the new renderer actually emits them); per-section typography
port must be verified against Phase-4 content.

**Verification (metadata-only projects):** for every `/projects/<slug>`, confirm
headings carry the shared `generateHeadingId()` ids and deep links scroll to real
targets; for projects without `content`, confirm the page renders the metadata
hero and *nothing else* — no empty section headings, `<hr/>` separators, or
placeholder spacing.

### Phase 6 — Retrieval & indexing rewrite (behavior change; local)

| File | Gains | Loses |
|---|---|---|
| `lib/indexing/types.ts` | `SanityProject.content?: PortableTextBlock[] \| null`; `projectsQuery` selects `content` | 11 legacy narrative fields in the type/query |
| `lib/indexing/adapters.ts` | maps fallback `content` | legacy field mapping |
| `lib/indexing/chunkers.ts` | `chunkProject` reuses the shared PT flatten + heading split from `lib/content/portable-text.ts` (no inline section-splitting logic); sections derive from document structure (heading-based); cites `#<heading-slug>` via the shared `generateHeadingId()`; tech/metrics chunks unchanged | 14 hard-coded named sections |
| `lib/retrieval/structured.ts` | document-oriented retrieval — `extractProjectFields` + `searchByTechnology`/`getProjectBySlugFromSanity` derive sections from `content` document structure by heading; no dependence on legacy narrative fields and no assumptions of predefined section names ("Engineering Decisions", "Results", …); tech/metrics summary from metadata fields | 11 flat-field reads |
| `scripts/index-content.ts` | semantic probes extended: each project's canonical headings retrievable (mirrors title probe at `index-content.ts:23`) | — |

**Dependencies:** Phase 0 (PT utils — required shared abstraction; `generateHeadingId()`), Phase 2 (`content`), Phase 5 (id scheme agreement).
**Complexity:** M.
**Risks:** R2 again — chunker anchors, renderer ids, and migrated headings must
share one slug scheme or chat citations silently break (plan §5.7 stability
requirement made concrete). The chunker must call the shared `generateHeadingId()`
— it must not re-implement slugification.

### Phase 7 — Verification (manual; not a PR)

Per `migration-plan.md` §4–6:

- Walk every `/projects/<slug>` page; verify block rendering, legacy anchors,
  routes, sitemap.
- Exercise the Publishing Agent locally: `publish_docs` round-trip, metadata
  create/update, spec-driven create, `read_project` returns `content`,
  separation of concerns.
- `npm run index-content` + semantic probes.
- Then `npm run lint`, `npm run typecheck`, `npm run build`.

### Phase 8 — Remove obsolete legacy code & schema (Step 5, incremental)

Cleanup is done **incrementally** — never as one large deletion. Each step leaves
the tree compiling and is independently reviewable:

| Step | Scope | Gate (verify before moving on) |
|---|---|---|
| 8a — remove legacy **code** references | `sanity/types.ts`; `sanity/queries.ts` (legacy selections in `projectBySlugQuery`); `sanity/fallbackContent.ts` (legacy narrative data, or convert to `content`); `lib/indexing/adapters.ts`; `scripts/publish-tool.ts` (legacy `ProjectPublishInput`/`ProjectReadOutput`/`readProjectQuery` fields; verify `publishProject` upsert is unused before deleting); `agent/publish_agent.py` (stale create/update field lists — done in Phase 3; legacy `detailedContent` skip stays); `AGENTS.md` (field-hierarchy sections) | lint/typecheck/build green **while the schema still exists** |
| 8b — run the `rg` scan, then remove legacy **schema** fields | run `rg "whyIBuiltIt\|theProblem\|..." app lib scripts sanity agent` *before* removing schema fields so remaining references are resolved against the still-present schema → no matches; then drop `whyIBuiltIt`, `theProblem`, `theSolution`, `architectureImage`, `engineeringDecisions`, `interestingChallenges`, `results`, `whatThisDemonstrates`, `exampleInputsOutputs`, `lessonsLearned`, `limitations`, `futureImprovements`, `timeline`, `faq`, `detailedContent`, `problemStatement`, `approach` from `sanity/schemaTypes/project.ts`; drop now-unused `Challenge`/`BeforeAfterComparison`/`FaqItem` from `sanity/types.ts` | lint/typecheck/build green |
| 8c — remove legacy **dataset** fields (final destructive step) | `client.patch(id).unset([...legacyFields])` locally (metadata untouched) — only **after** the application is verified on the new model | local dataset free of legacy fields; pages + agent round-trip still green |
| 8d — final verification | walk every `/projects/<slug>` page, exercise the agent round-trip, reindex, then lint/typecheck/build | migration-plan §4–6 checklist |

Update `AGENTS.md` to document the new `docs/` model once 8d passes.

### Phase 9 — Promote (Step 6)

`sync-dataset.ts local-to-prod --replace`, deploy code, rebuild production index,
then run the expanded smoke check below.

**Smoke-test checklist (post-promotion):**

1. **Project documentation rendering** — spot-check every `/projects/<slug>`
   page renders its `content` blocks (prose, code, tables, images, callouts,
   cards); metadata-only projects render the hero alone.
2. **Heading anchor navigation** — each rendered heading carries the shared
   `generateHeadingId()` id and deep links (e.g. `#engineering-decisions`) scroll
   to the correct section.
3. **Retrieval/indexing behavior** — `npm run index-content` completes with the
   semantic probes green; retrieval citations resolve against the live index.
4. **Publishing Agent round-trip** — against the promoted dataset, exercise
   `publish_docs`, metadata create/update, spec-driven create, and `read_project`
   returning `content`.

**Rollback (documented for both layers):**

- **Code rollback:** `git revert` the promotion commit / feature-branch merge.
  Because each phase landed as a reviewable PR, reverting to the last-known-good
  commit restores the previous renderer, chunker, and schema.
- **Production dataset rollback:** take a pre-promotion snapshot first
  (`sanity dataset export production <backup.ndjson>`). To recover, re-import it
  with `npx sanity dataset import <backup.ndjson> production --replace`. The
  backup preserves the legacy narrative and populated `content`, so metadata is
  recoverable. Re-run the smoke-test checklist before re-committing the promotion.

---

## 2. Dependencies between phases

```
P0 (refactors) ─► P1 (tooling) ─► P2 (schema) ─► P3 (publish-docs+agent)
                                  │                │
                                  └────────► P4 (migration) ─► P5 (renderer)
P0 ─► P2 ─► P5 ─► P6 (retrieval)      ▲
P1 ─► P4                              │
P0 ─► P4 (upload util, headings)      └─ P3 feeds P4's publish step
P2,P5,P6 verified ─► P7 (verify) ─► P8 (cleanup) ─► P9 (promote)
```

Critical edges:

- **P5 needs P4** — the renderer is content-only, so local `content` must exist
  for the rewrite to be verifiable.
- **P6 needs P5's id scheme** — chunker anchors, renderer ids, and migrated
  headings must agree.
- **P8 needs all rewrites verified.**
- **Production is untouched until P9** — the replace-style property holds because
  every PR is on the feature branch against the local dataset.

---

## 3. Shared abstractions & pure refactoring opportunities (do before behavior changes)

1. Extract heading-id logic into the single canonical `generateHeadingId()` in
   `lib/content/headings.ts` and consume from `lib/project-docs-source.ts` +
   `lib/indexing/chunkers.ts` — and, from Phase 4 on, the migration and the
   Phase-5 renderer. No consumer implements its own slugification.
2. Add `lib/content/portable-text.ts` (PT flatten + heading split) before any
   retrieval rewrite. This is a **required shared abstraction**, not optional:
   the chunker and retrieval layer must reuse it rather than maintain independent
   implementations (no inline section-splitting in `chunkProject()` or other
   consumers).
3. Extract `uploadImage` into a shared script module.
4. DRY the block config so `projectDocumentationPage.body.of` and
   `project.content.of` share one definition.

---

## 4. Risks not already documented in the architecture docs

- **R1 — No test infrastructure exists.** The repo has zero tests and no test
  runner; `migration-plan.md` §3.0 assumes regression tests. A runner must be
  introduced (recommend `vitest`) — a decision with dependency implications.
- **R2 — Anchor/id scheme conflict.** `createToc` (`lib/project-docs-source.ts:284`)
  appends `-<8-char key>` to heading ids; the *current* page emits no ids at all.
  Preserving legacy `#why-i-built-it` citations requires the project page to emit
  bare-slugified heading ids and the chunker to compute identical ones. One shared
  scheme must be decided and used by serializer keys, renderer ids, and chunker
  anchors, or §5.7 stability silently fails. This is enforced by the single
  `generateHeadingId()` in `lib/content/headings.ts` (Phase 0): renderer,
  migration, and chunker all call it, so there is no second slugification to
  drift.
- **R3 — No Markdown parser dependency installed.** The serializer and its
  `--check` AST comparison imply a real parser (`unified`/`remark-*`) — new deps
  need approval, or we hand-roll a constrained parser (slower, more code, weaker
  `--check`).
- **R4 — Sanity `_key` charset.** Content-hash-derived stable `_key`s must be
  sanitized to Sanity's allowed charset (the plan's stable-key requirement for
  idempotent re-runs).
- **R5 — `documentationImage.alt` is required** (`documentationBlocks.ts:429`).
  Serializer and the `architectureImage` migration must always emit alt text.
- **R6 — Fallback-content narrative loss.** If fallback projects become
  metadata-only, the no-Sanity dev experience loses all narrative (plan §3.4
  explicitly allows this — flag the UX tradeoff before committing).
- **R7 — `setGenericFields` copies unknown keys verbatim** (`publish-tool.ts:74`).
  `content` must stay out of `ProjectPublishInput`; add a defensive exclusion so
  a future payload can't clobber the narrative via the metadata path.
- **R8 — `SYSTEM_PROMPT`/tool-arg field lists are stale and dual-source** (agent
  §1.3). Full regeneration-from-schema is a larger change than the migration
  strictly needs; recommend trimming stale fields now and leaving regeneration as
  a follow-up to keep the agent PR small.
- **R9 — New `projects/<slug>/docs/` convention.** A new top-level repo directory;
  needs a documented layout rule (and `.gitignore`/asset-path conventions) so image
  paths resolve against the docs dir.

---

## 5. Ordered implementation checklist (each task = one reviewable PR)

| # | Task | Files | Depends | Complexity | Acceptance |
|---|---|---|---|---|---|
| T1 | Add test runner + `test` script | `package.json`, `vitest.config.*`, one smoke test | — | S | `npm test` green |
| T2 | Extract shared heading/PT utils; refactor consumers | `lib/content/headings.ts` (`generateHeadingId()`), `lib/content/portable-text.ts` (required abstraction), `lib/project-docs-source.ts`, `lib/indexing/chunkers.ts` | T1 | S | lint/typecheck/build green; doc-page TOC unchanged; no consumer inlines its own slugification |
| T3 | Extract shared `uploadImage` | `scripts/lib/upload.ts`, `scripts/publish-tool.ts` | — | S | metadata bridge behavior unchanged |
| T4 | `discover-docs.ts` + tests | `lib/content/discover-docs.ts`, tests | T1, T2 | S-M | ordering/caps/error cases covered |
| T5 | md→PT serializer + tests (incl. `--check`) | `lib/content/markdown-to-pt.ts`, tests | T1, T2, T4 | L | every block mapping + round-trip cases green |
| T6 | Schema: `content`, `faqItem`, `challengeCard`, shared block config | `sanity/schemaTypes/project.ts`, `sanity/schemaTypes/documentationBlocks.ts`, `sanity/schemaTypes/index.ts`, `sanity/schemaTypes/projectDocumentationPage.ts`, `sanity/types.ts` | — | M | Studio shows `content`; typecheck green |
| T7 | Read surfaces select `content` | `sanity/queries.ts`, `scripts/publish-tool.ts` (`readProject`), `sanity/fallbackContent.ts`, `lib/indexing/adapters.ts` | T6 | S | `read-project.ts` returns `content`; pages still render legacy fields |
| T8 | `publish-docs.ts` bridge | `scripts/publish-docs.ts` | T3, T4, T5, T6 | M | round-trip patch to local `content` with stable keys; separation verified (no metadata mutation) |
| T9 | Agent `publish_docs` tool + prompt cleanup + `content` exclusion | `agent/publish_agent.py` | T8 | S-M | agent publishes docs locally; metadata path untouched |
| T10 | `migrate-legacy-content.ts` → committed `docs/` → `content` | `scripts/migrate-legacy-content.ts`, `projects/<slug>/docs/*.md` | T8 | M-L | per-project diff summary; local `content` populated; legacy anchors preserved |
| T11 | Renderer rewrite: content-only page + new block components + heading ids | `app/projects/[slug]/page.tsx`, `components/DocumentationBlocks.tsx` | T6, T10 | M | pages render from `content`; heading ids via shared `generateHeadingId()`; anchors resolve; metadata-only projects render hero with no empty headings/separators/spacing |
| T12 | Index rewrite: `SanityProject.content`, query, chunker | `lib/indexing/types.ts`, `lib/indexing/adapters.ts`, `lib/indexing/chunkers.ts` | T2, T6, T11 | M | `chunkProject` reuses shared PT flatten/split (no inline section-splitting) + shared `generateHeadingId()` anchors; content-derived sections; tech/metrics chunks intact |
| T13 | Structured retrieval rewrite + probes | `lib/retrieval/structured.ts`, `scripts/index-content.ts` | T12 | M | document-oriented retrieval with no predefined-section assumptions; tech/metrics queries work; headings retrievable; probes pass |
| T14 | Manual verification (pages, agent e2e, index, gate) | — | T11–T13 | S | `migration-plan.md` §4–6 checklist |
| T15a | Cleanup (code): remove legacy code references | `sanity/types.ts`, `sanity/queries.ts`, `sanity/fallbackContent.ts`, `lib/indexing/adapters.ts`, `scripts/publish-tool.ts`, `agent/publish_agent.py`, `AGENTS.md` | T14 | M | lint/typecheck/build green while schema still present |
| T15b | Cleanup (schema): `rg` scan → remove legacy schema fields | `sanity/schemaTypes/project.ts`, `sanity/types.ts` | T15a | S | `rg` clean before removal; lint/typecheck/build green |
| T15c | Cleanup (dataset): unset legacy fields locally (final destructive step) | dataset | T15b | S | local dataset free of legacy fields; pages + agent round-trip verified |
| T16 | Promote: sync local→prod, deploy, reindex, expanded smoke | ops | T15c | S | production on new model; smoke checklist (docs, anchors, indexing, agent round-trip) green |

**Notes on ordering**

- T1–T3 are pure/parallel-safe refactors and can land first.
- T4/T5 are the big new-code chunks.
- The renderer rewrite (T11) is deliberately placed *after* the migration (T10)
  so it is verifiable against real local `content`. Until then, existing behavior
  is fully preserved (per the "preserve behavior until the migration phase" rule).
- T12/T13 are the only behavior-changing rewrites left after T11 and together form
  migration-plan Step 1's retrieval leg; they can be one PR if preferred, but
  splitting keeps them independently reviewable.

**Decisions to confirm before implementation**

1. Test runner — recommend `vitest`.
2. Serializer engine — recommend `unified` + `remark-parse` for a genuine AST and
   a real `--check`.
3. Fallback projects — recommend *metadata-only* fallbacks per plan §3.4.
4. Agent prompt — recommend the minimal trim (T9) now, schema-driven prompt
   regeneration as a later follow-up.
