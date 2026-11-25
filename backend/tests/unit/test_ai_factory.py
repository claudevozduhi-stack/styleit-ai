"""Выбор ИИ-сервиса по настройке AI_PROVIDER."""

import pytest
from pydantic import ValidationError

from app.ai.claude_client import ClaudeClient
from app.ai.client import GeminiClient
from app.ai.factory import build_llm
from app.core.config import Settings


def test_claude_is_default() -> None:
    settings = Settings(_env_file=None)
    assert settings.claude_model == "claude-haiku-5-5"
    assert isinstance(build_llm(settings), ClaudeClient)


def test_gemini_can_be_selected() -> None:
    settings = Settings(_env_file=None, ai_provider="gemini")
    assert isinstance(build_llm(settings), GeminiClient)


def test_unknown_provider_fails_at_startup() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, ai_provider="other")
