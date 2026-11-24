"""Проверки обёртки над Gemini SDK без сети: SDK-клиент подменяется."""

import asyncio
from types import SimpleNamespace
from typing import Any

import pytest
from google.genai import errors as genai_errors
from pydantic import BaseModel

from app.ai.client import GeminiClient, Message
from app.ai.errors import AIInvalidResponseError, AIQuotaExceededError, AIUnavailableError


class Answer(BaseModel):
    """Простая схема ответа для теста."""

    value: int


class FakeModels:
    """Имитирует client.aio.models: отдаёт заданный ответ или бросает ошибку."""

    def __init__(self, result: Any) -> None:
        self.result = result
        self.kwargs: dict[str, Any] = {}

    async def generate_content(self, **kwargs: Any) -> Any:
        self.kwargs = kwargs
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def client_with(result: Any) -> tuple[GeminiClient, FakeModels]:
    """GeminiClient, у которого вместо SDK — подменный объект."""
    client = GeminiClient(api_key="test-key", model="gemini-test")
    models = FakeModels(result)
    client._client = SimpleNamespace(aio=SimpleNamespace(models=models))  # type: ignore[assignment]
    return client, models


def run(client: GeminiClient) -> tuple[Answer, str, Any]:
    """Выполняет один запрос синхронно."""
    return asyncio.run(client.generate_json("система", [Message("user", "вопрос")], Answer))


def test_parses_json_and_usage() -> None:
    response = SimpleNamespace(
        text='{"value": 7}',
        usage_metadata=SimpleNamespace(prompt_token_count=11, candidates_token_count=3),
    )
    client, models = client_with(response)
    parsed, raw, usage = run(client)
    assert parsed.value == 7
    assert raw == '{"value": 7}'
    assert (usage.input_tokens, usage.output_tokens) == (11, 3)
    assert models.kwargs["model"] == "gemini-test"
    assert models.kwargs["config"].response_mime_type == "application/json"
    assert models.kwargs["config"].system_instruction == "система"


def test_invalid_json_raises() -> None:
    client, _ = client_with(SimpleNamespace(text="не json", usage_metadata=None))
    with pytest.raises(AIInvalidResponseError):
        run(client)


def test_quota_error_is_mapped() -> None:
    client, _ = client_with(genai_errors.ClientError(429, {"error": {"message": "quota"}}))
    with pytest.raises(AIQuotaExceededError):
        run(client)


def test_other_api_error_is_mapped() -> None:
    client, _ = client_with(genai_errors.ServerError(500, {"error": {"message": "boom"}}))
    with pytest.raises(AIUnavailableError):
        run(client)


def test_missing_key_raises_unavailable() -> None:
    client = GeminiClient(api_key="", model="gemini-test")
    with pytest.raises(AIUnavailableError, match="GEMINI_API_KEY"):
        run(client)
