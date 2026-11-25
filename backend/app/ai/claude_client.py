"""Клиент Claude API (Anthropic) для получения ответа строго по Pydantic-схеме.

Используется официальный SDK `anthropic` и structured outputs: схема ответа передаётся
в `output_config.format`, и API гарантирует, что текст ответа — JSON этой формы.
Код всё равно проверяет ответ через Pydantic, как и для Gemini.
"""

import logging

import anthropic
from anthropic.types import Message as ApiMessage
from anthropic.types import MessageParam
from pydantic import BaseModel, ValidationError

from app.ai.client import Message, Usage
from app.ai.errors import AIInvalidResponseError, AIQuotaExceededError, AIUnavailableError

# Запас на ответ: капсула занимает 1–2 тыс. токенов, остальное — на размышления модели.
MAX_OUTPUT_TOKENS = 16000
# Сколько секунд ждать ответа, прежде чем считать сервис недоступным.
REQUEST_TIMEOUT_SECONDS = 90.0
# Подстрока, по которой Anthropic сообщает о нулевом балансе (ответ 400).
LOW_BALANCE_MARKER = "credit balance"
HTTP_SERVER_ERROR = 500

logger = logging.getLogger(__name__)


class ClaudeClient:
    """Реализация LLMClient поверх официального SDK anthropic."""

    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model
        # Клиент создаётся лениво: без ключа приложение должно запускаться,
        # а ошибка возникать только при обращении к ИИ.
        self._client: anthropic.AsyncAnthropic | None = None

    def _get_client(self) -> anthropic.AsyncAnthropic:
        """Возвращает SDK-клиент, создавая его при первом вызове."""
        if not self._api_key:
            raise AIUnavailableError("ИИ-сервис не настроен: не задан ANTHROPIC_API_KEY.")
        if self._client is None:
            self._client = anthropic.AsyncAnthropic(
                api_key=self._api_key, timeout=REQUEST_TIMEOUT_SECONDS
            )
        return self._client

    def _map_status_error(self, exc: anthropic.APIStatusError) -> Exception:
        """Переводит ошибку Claude API в ошибку приложения с понятной причиной.

        В лог пишется только код и текст ответа Anthropic: в них нет данных пользователя,
        зато по ним видно, почему отклонён ключ или не найдена модель.
        """
        logger.warning("Claude API error %s: %s", exc.status_code, exc.message)
        if isinstance(exc, anthropic.RateLimitError):
            return AIQuotaExceededError("ИИ-сервис сейчас перегружен. Попробуйте через минуту.")
        if isinstance(exc, anthropic.AuthenticationError | anthropic.PermissionDeniedError):
            return AIUnavailableError(
                f"Anthropic отклонил ключ Claude (код {exc.status_code}). "
                "Проверьте ANTHROPIC_API_KEY в настройках сервера."
            )
        if isinstance(exc, anthropic.NotFoundError):
            return AIUnavailableError(
                f"Модель {self._model} недоступна для этого ключа. Проверьте CLAUDE_MODEL."
            )
        if LOW_BALANCE_MARKER in exc.message.lower():
            return AIUnavailableError(
                "На счёте Claude API закончились средства. Пополните баланс в консоли Anthropic."
            )
        if exc.status_code >= HTTP_SERVER_ERROR:
            return AIUnavailableError("ИИ-сервис временно недоступен. Попробуйте позже.")
        return AIUnavailableError(f"ИИ-сервис ответил ошибкой {exc.status_code}.")

    async def _send(
        self, system: str, messages: list[Message], schema: type[BaseModel]
    ) -> ApiMessage:
        """Отправляет запрос с JSON-схемой ответа и переводит ошибки SDK в ошибки приложения."""
        # В нашем протоколе реплики модели помечены "model", у Claude это "assistant".
        api_messages: list[MessageParam] = [
            {"role": "assistant" if item.role == "model" else "user", "content": item.text}
            for item in messages
        ]
        try:
            return await self._get_client().messages.create(
                model=self._model,
                max_tokens=MAX_OUTPUT_TOKENS,
                system=system,
                messages=api_messages,
                output_config={
                    "format": {
                        "type": "json_schema",
                        "schema": anthropic.transform_schema(schema),
                    }
                },
            )
        except anthropic.APIStatusError as exc:
            raise self._map_status_error(exc) from exc
        except anthropic.APIConnectionError as exc:
            logger.warning("Claude API connection error: %s", type(exc).__name__)
            raise AIUnavailableError("Не удалось связаться с ИИ-сервисом.") from exc

    async def generate_json[T: BaseModel](
        self, system: str, messages: list[Message], schema: type[T]
    ) -> tuple[T, str, Usage]:
        """Отправляет диалог в Claude и требует ответ в JSON по схеме."""
        response = await self._send(system, messages, schema)
        usage = Usage(
            input_tokens=response.usage.input_tokens, output_tokens=response.usage.output_tokens
        )
        if response.stop_reason == "refusal":
            raise AIInvalidResponseError("Модель отказалась отвечать на запрос.")
        if response.stop_reason == "max_tokens":
            raise AIInvalidResponseError("Ответ модели оборвался на лимите длины.")
        # Перед текстом могут идти блоки размышлений: JSON — в первом текстовом блоке.
        text = next((block.text for block in response.content if block.type == "text"), "")
        try:
            parsed = schema.model_validate_json(text)
        except ValidationError as exc:
            raise AIInvalidResponseError("Ответ модели не соответствует схеме.") from exc
        return parsed, text, usage
