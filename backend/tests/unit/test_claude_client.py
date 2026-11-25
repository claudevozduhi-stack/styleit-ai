"""Проверки обёртки над Claude SDK без сети: SDK-клиент подменяется."""

import asyncio
from types import SimpleNamespace
from typing import Any

import anthropic
import httpx2
import pytest
from pydantic import BaseModel

from app.ai.claude_client import ClaudeClient
from app.ai.client import Message
from app.ai.errors import AIInvalidResponseError, AIQuotaExceededError, AIUnavailableError

API_URL = "https://api.anthropic.com/v1/messages"


class Answer(BaseModel):
    """Простая схема ответа для теста."""

    value: int


class FakeMessages:
    """Имитирует client.messages: отдаёт заданный ответ или бросает ошибку."""

    def __init__(self, result: Any) -> None:
        self.result = result
        self.kwargs: dict[str, Any] = {}

    async def create(self, **kwargs: Any) -> Any:
        self.kwargs = kwargs
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def client_with(result: Any) -> tuple[ClaudeClient, FakeMessages]:
    """ClaudeClient, у которого вместо SDK — подменный объект."""
    client = ClaudeClient(api_key="test-key", model="claude-test")
    messages = FakeMessages(result)
    client._client = SimpleNamespace(messages=messages)  # type: ignore[assignment]
    return client, messages


def response(text: str, stop_reason: str = "end_turn") -> SimpleNamespace:
    """Ответ SDK: блок размышлений, затем текст с JSON."""
    return SimpleNamespace(
        content=[
            SimpleNamespace(type="thinking", thinking="..."),
            SimpleNamespace(type="text", text=text),
        ],
        stop_reason=stop_reason,
        usage=SimpleNamespace(input_tokens=11, output_tokens=3),
    )


def status_error(cls: type[anthropic.APIStatusError], code: int, text: str) -> Exception:
    """Ошибка SDK с настоящим HTTP-ответом, как её создаёт сам SDK."""
    request = httpx2.Request("POST", API_URL)
    return cls(text, response=httpx2.Response(code, request=request), body=None)


def run(client: ClaudeClient, history: list[Message] | None = None) -> tuple[Answer, str, Any]:
    """Выполняет один запрос синхронно."""
    messages = history or [Message("user", "вопрос")]
    return asyncio.run(client.generate_json("система", messages, Answer))


def test_parses_json_and_usage() -> None:
    client, messages = client_with(response('{"value": 7}'))
    parsed, raw, usage = run(client)
    assert parsed.value == 7
    assert raw == '{"value": 7}'
    assert (usage.input_tokens, usage.output_tokens) == (11, 3)
    kwargs = messages.kwargs
    assert kwargs["model"] == "claude-test"
    assert kwargs["system"] == "система"
    assert kwargs["output_config"]["format"]["type"] == "json_schema"
    assert kwargs["output_config"]["format"]["schema"]["required"] == ["value"]
    # Сэмплинг не задаём: у новых моделей нестандартная температура — ошибка 400.
    assert "temperature" not in kwargs


def test_model_role_becomes_assistant() -> None:
    client, messages = client_with(response('{"value": 1}'))
    history = [Message("user", "вопрос"), Message("model", "{}"), Message("user", "исправь")]
    run(client, history)
    roles = [item["role"] for item in messages.kwargs["messages"]]
    assert roles == ["user", "assistant", "user"]


def test_invalid_json_raises() -> None:
    client, _ = client_with(response("не json"))
    with pytest.raises(AIInvalidResponseError):
        run(client)


@pytest.mark.parametrize("stop_reason", ["refusal", "max_tokens"])
def test_unfinished_answer_raises(stop_reason: str) -> None:
    client, _ = client_with(response('{"value": 1}', stop_reason))
    with pytest.raises(AIInvalidResponseError):
        run(client)


def test_missing_key_raises_unavailable() -> None:
    client = ClaudeClient(api_key="", model="claude-test")
    with pytest.raises(AIUnavailableError, match="ANTHROPIC_API_KEY"):
        run(client)


def test_rate_limit_is_mapped() -> None:
    client, _ = client_with(status_error(anthropic.RateLimitError, 429, "rate limit"))
    with pytest.raises(AIQuotaExceededError):
        run(client)


@pytest.mark.parametrize(
    ("cls", "code"),
    [(anthropic.AuthenticationError, 401), (anthropic.PermissionDeniedError, 403)],
)
def test_rejected_key_is_explained(cls: type[anthropic.APIStatusError], code: int) -> None:
    client, _ = client_with(status_error(cls, code, "denied"))
    with pytest.raises(AIUnavailableError, match="ANTHROPIC_API_KEY"):
        run(client)


def test_unknown_model_is_explained() -> None:
    client, _ = client_with(status_error(anthropic.NotFoundError, 404, "model not found"))
    with pytest.raises(AIUnavailableError, match="CLAUDE_MODEL"):
        run(client)


def test_low_balance_is_explained() -> None:
    error = status_error(
        anthropic.BadRequestError, 400, "Your credit balance is too low to access the API."
    )
    client, _ = client_with(error)
    with pytest.raises(AIUnavailableError, match="Пополните баланс"):
        run(client)


def test_server_error_is_mapped() -> None:
    client, _ = client_with(status_error(anthropic.InternalServerError, 500, "boom"))
    with pytest.raises(AIUnavailableError, match="временно недоступен"):
        run(client)


def test_connection_error_is_mapped() -> None:
    error = anthropic.APIConnectionError(request=httpx2.Request("POST", API_URL))
    client, _ = client_with(error)
    with pytest.raises(AIUnavailableError, match="связаться"):
        run(client)
