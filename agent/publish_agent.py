#!/usr/bin/env python3

"""AI portfolio publishing agent.

Natural-language interface for managing projects in a Sanity CMS portfolio.
Supports the full lifecycle: create, read, update, publish, unpublish, delete.

This module is the application entry point.  It owns:
  - runtime configuration
  - LLM initialization
  - LangGraph graph construction
  - prompt registration
  - tool registration
  - REPL loop

All other responsibilities live in dedicated modules:
  - llm.py         — LLM provider abstraction (registry-based)
  - tools.py       — LangChain tool definitions (thin adapters)
  - prompts.py     — system prompt
  - services.py    — business workflow orchestration
  - spec_pipeline.py — spec-driven project creation pipeline
  - bridges.py     — TypeScript bridge subprocess execution
  - state.py       — mutable application state (schema cache, pending create)
"""

from __future__ import annotations

from langgraph.graph import StateGraph, MessagesState
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import SystemMessage, ToolMessage

from llm import create_chat_model, get_model_name
from prompts import SYSTEM_PROMPT
from tools import tools


# ── Graph construction ───────────────────────────────────


def create_agent():
    llm = create_chat_model().bind_tools(tools)

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

    print(f"Portfolio Publishing Agent ({get_model_name()})")
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
