"""LLM provider abstraction for the publishing agent.

Single module that owns all provider-specific instantiation.  The rest of
the agent imports only ``create_chat_model()`` and ``get_model_name()``,
never a provider-specific class.

Adding a new provider requires only a ``@register("name")`` decorated
function — no changes to existing code.
"""

from __future__ import annotations

import os
from typing import Callable

from langchain_core.language_models.chat_models import BaseChatModel

# ── Provider registry ────────────────────────────────────

_PROVIDERS: dict[str, Callable[[], BaseChatModel]] = {}


def register(name: str):
    """Decorator to register an LLM provider factory."""

    def decorator(fn: Callable[[], BaseChatModel]):
        _PROVIDERS[name] = fn
        return fn

    return decorator


# ── Configuration ────────────────────────────────────────
#
# New env vars: AGENT_LLM_PROVIDER, AGENT_LLM_MODEL, AGENT_LLM_BASE_URL,
# AGENT_LLM_API_KEY, AGENT_LLM_TEMPERATURE.
#
# Backward compatibility: if AGENT_LLM_MODEL is unset, falls back to
# OLLAMA_MODEL; if AGENT_LLM_BASE_URL is unset, falls back to OLLAMA_URL.
# This lets existing .env.local files work without changes.


def _provider() -> str:
    return os.environ.get("AGENT_LLM_PROVIDER", "ollama")


def get_model_name() -> str:
    """Return the configured model name (provider-neutral)."""
    return os.environ.get(
        "AGENT_LLM_MODEL",
        os.environ.get("OLLAMA_MODEL", "qwen3:4b"),
    )


def _base_url(default: str = "http://localhost:11434") -> str:
    """Return the configured base URL with legacy fallback."""
    return os.environ.get(
        "AGENT_LLM_BASE_URL",
        os.environ.get("OLLAMA_URL", default),
    )


def _api_key() -> str | None:
    """Return the configured API key, or None."""
    return os.environ.get("AGENT_LLM_API_KEY")


def _temperature() -> float:
    return float(os.environ.get("AGENT_LLM_TEMPERATURE", "0"))


# ── Provider implementations ─────────────────────────────


@register("ollama")
def _ollama() -> BaseChatModel:
    from langchain_ollama import ChatOllama

    return ChatOllama(
        base_url=_base_url(),
        model=get_model_name(),
        temperature=_temperature(),
    )


@register("openai")
def _openai() -> BaseChatModel:
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=get_model_name(),
        api_key=_api_key(),
        temperature=_temperature(),
        base_url=os.environ.get("AGENT_LLM_BASE_URL"),  # None = OpenAI default
    )


@register("anthropic")
def _anthropic() -> BaseChatModel:
    from langchain_anthropic import ChatAnthropic

    return ChatAnthropic(
        model=get_model_name(),
        api_key=_api_key(),
        temperature=_temperature(),
    )


@register("bedrock")
def _bedrock() -> BaseChatModel:
    from langchain_aws import ChatBedrockConverse

    return ChatBedrockConverse(
        model=get_model_name(),
        temperature=_temperature(),
        region_name=os.environ.get("AWS_REGION", "us-east-1"),
    )


@register("gemini")
def _gemini() -> BaseChatModel:
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=get_model_name(),
        google_api_key=_api_key(),
        temperature=_temperature(),
    )


# ── Public API ───────────────────────────────────────────


def create_chat_model() -> BaseChatModel:
    """Create a chat model for the configured provider.

    Returns a generic ``BaseChatModel`` — callers use ``.bind_tools()``
    or ``.with_structured_output()`` without knowing the provider.
    """
    provider = _provider()
    factory = _PROVIDERS.get(provider)
    if factory is None:
        available = ", ".join(sorted(_PROVIDERS))
        raise ValueError(
            f"Unknown AGENT_LLM_PROVIDER={provider!r}. "
            f"Available: {available}"
        )
    return factory()
