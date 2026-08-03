#!/usr/bin/env python3

"""AI portfolio publishing agent.

Natural-language interface for managing projects in a Sanity CMS portfolio.
Supports the full lifecycle: create, read, update, publish, unpublish, delete.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Annotated

import spec_pipeline
from services import (
    DatasetSyncService,
    IndexService,
    ProjectService,
    PublishingService,
)

from langchain_ollama import ChatOllama
from langgraph.graph import StateGraph, MessagesState
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import SystemMessage, ToolMessage
from langchain_core.tools import tool

# ── Configuration ────────────────────────────────────────

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:4b")
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# ── Service singletons ───────────────────────────────────

project_svc = ProjectService()
publishing_svc = PublishingService()
index_svc = IndexService()
dataset_sync_svc = DatasetSyncService()

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
