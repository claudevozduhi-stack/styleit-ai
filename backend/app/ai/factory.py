"""Выбор ИИ-сервиса по настройке AI_PROVIDER: Claude (основной) или Gemini (запасной)."""

from app.ai.claude_client import ClaudeClient
from app.ai.client import GeminiClient, LLMClient
from app.core.config import Settings


def build_llm(settings: Settings) -> LLMClient:
    """Создаёт клиент выбранного сервиса. Остальной код видит только протокол LLMClient."""
    if settings.ai_provider == "gemini":
        return GeminiClient(settings.gemini_api_key, settings.gemini_model)
    return ClaudeClient(settings.anthropic_api_key, settings.claude_model)
