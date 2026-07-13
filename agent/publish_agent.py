#!/usr/bin/env python3

"""AI portfolio publishing agent.

Natural-language interface for managing projects in a Sanity CMS portfolio.
Supports the full lifecycle: create, read, update, publish, unpublish, delete.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Annotated

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
    bridge = PROJECT_ROOT / "scripts" / "list-projects.ts"
    args = ["npx", "tsx", str(bridge)]
    if search:
        args.append(search)
    result = subprocess.run(args, capture_output=True, text=True, cwd=PROJECT_ROOT)
    if result.returncode != 0:
        return f"Error: {result.stderr.strip()}"
    return result.stdout.strip()


@tool
def read_project(
    slug: Annotated[str, "Project slug (URL identifier) to fetch"],
) -> str:
    """Read an existing project's current data from Sanity by slug."""
    bridge = PROJECT_ROOT / "scripts" / "read-project.ts"
    result = subprocess.run(
        ["npx", "tsx", str(bridge), slug],
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
    )
    if result.returncode != 0:
        return f"Error: {result.stderr.strip()}"
    return result.stdout.strip()


# ── Lifecycle mutation tools ─────────────────────────────


@tool
def create_project(
    project_data: Annotated[
        dict,
        (
            "Structured project data for a NEW project. Fails if the slug already exists. "
            "Fields: title (required), slug (required), shortSummary, "
            "coverImage, coverImageAlt, technologies[], keyMetrics[], "
            "githubUrl, demoUrl, featured, displayOrder, problemStatement, "
            "approach, results, architectureImage, architectureImageAlt, "
            "screenshots[], screenshotAlts[], limitations, futureImprovements. "
            "Image paths must be relative to the markdown file's directory."
        ),
    ],
) -> str:
    """Create a NEW project in the Sanity CMS portfolio. Fails if slug already exists."""
    required = ("title", "slug")
    missing = [f for f in required if not project_data.get(f)]
    if missing:
        return f"Error: missing required fields: {', '.join(missing)}"

    fd, tmp_path = tempfile.mkstemp(suffix=".json", prefix="project_")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(project_data, f, indent=2)

        bridge = PROJECT_ROOT / "scripts" / "create-project.ts"
        result = subprocess.run(
            ["npx", "tsx", str(bridge), tmp_path],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT,
        )
        if result.returncode != 0:
            return f"Error creating project:\n{result.stderr.strip()}"
        return result.stdout.strip()
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
            "Fields: title, shortSummary, coverImage, coverImageAlt, technologies[], "
            "keyMetrics[], githubUrl, demoUrl, featured, displayOrder, problemStatement, "
            "approach, results, architectureImage, architectureImageAlt, "
            "screenshots[], screenshotAlts[], limitations, futureImprovements."
        ),
    ],
) -> str:
    """Update specific fields of an EXISTING project. Fails if slug not found. True partial update — only included fields are changed."""
    fd, tmp_path = tempfile.mkstemp(suffix=".json", prefix="project_")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(project_data, f, indent=2)

        bridge = PROJECT_ROOT / "scripts" / "update-project.ts"
        result = subprocess.run(
            ["npx", "tsx", str(bridge), tmp_path, slug],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT,
        )
        if result.returncode != 0:
            return f"Error updating project:\n{result.stderr.strip()}"
        return result.stdout.strip()
    finally:
        os.unlink(tmp_path)


@tool
def publish_project(
    slug: Annotated[str, "Slug of the project to publish"],
) -> str:
    """Publish an existing project, making it visible on the public portfolio site."""
    bridge = PROJECT_ROOT / "scripts" / "publish-project.ts"
    result = subprocess.run(
        ["npx", "tsx", str(bridge), slug],
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
    )
    if result.returncode != 0:
        return f"Error publishing project:\n{result.stderr.strip()}"
    return result.stdout.strip()


@tool
def unpublish_project(
    slug: Annotated[str, "Slug of the project to unpublish"],
) -> str:
    """Unpublish an existing project, hiding it from the public portfolio site."""
    bridge = PROJECT_ROOT / "scripts" / "unpublish-project.ts"
    result = subprocess.run(
        ["npx", "tsx", str(bridge), slug],
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
    )
    if result.returncode != 0:
        return f"Error unpublishing project:\n{result.stderr.strip()}"
    return result.stdout.strip()


@tool
def delete_project(
    slug: Annotated[str, "Project slug (URL identifier) to delete"],
) -> str:
    """Delete a project and its documentation pages from Sanity by slug."""
    bridge = PROJECT_ROOT / "scripts" / "delete-project.ts"
    result = subprocess.run(
        ["npx", "tsx", str(bridge), slug],
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
    )
    if result.returncode != 0:
        return f"Error: {result.stderr.strip()}"
    return result.stdout.strip()


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

CRITICAL: Each operation has its OWN dedicated tool. Do NOT use one tool as a
substitute for another. Read the intent carefully and pick the correct tool.

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

── SCHEMA FIELDS (for create_project and update_project) ──

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
- problemStatement (markdown): Problem description.
- approach (markdown): Solution approach.
- results (markdown): Outcomes.
- architectureImage (string): Relative path to architecture diagram.
- architectureImageAlt (string): Alt text for architecture diagram.
- screenshots (array of strings): Relative paths to screenshots.
- screenshotAlts (array of strings): Alt texts for screenshots.
- limitations (markdown): Known limitations.
- futureImprovements (markdown): Planned improvements.

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
