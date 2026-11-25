"""Клиент Gemini API для получения ответа строго по Pydantic-схеме.

Остальной код работает с протоколом LLMClient, а не с SDK напрямую.
Это позволяет в тестах подменить модель заранее заданными ответами и
не ходить в сеть.
"""

import logging
from dataclasses import dataclass
from typing import Protocol

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.ai.errors import AIInvalidResponseError, AIQuotaExceededError, AIUnavailableError

HTTP_TOO_MANY_REQUESTS = 429
# Коды, которыми Google отвечает на неверный, ограниченный или заблокированный ключ.
KEY_REJECTED_CODES = frozenset({400, 401, 403})
HTTP_NOT_FOUND = 404

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Message:
    """Одна реплика диалога с моделью."""

    role: str  # "user" или "model"
    text: str


@dataclass(frozen=True)
class Usage:
    """Расход токенов на один запрос — для обезличенной статистики."""

    input_tokens: int
    output_tokens: int


class LLMClient(Protocol):
    """Минимальный интерфейс языковой модели, который нужен стилисту."""

    async def generate_json[T: BaseModel](
        self, system: str, messages: list[Message], schema: type[T]
    ) -> tuple[T, str, Usage]:
        """Возвращает разобранный объект, исходный JSON-текст ответа и расход токенов."""
        ...


class GeminiClient:
    """Реализация LLMClient поверх официального SDK google-genai."""

    def __init__(self, api_key: str, model: str, temperature: float = 0.4) -> None:
        self._api_key = api_key
        self._model = model
        self._temperature = temperature
        # Клиент создаётся лениво: без ключа приложение должно запускаться,
        # а ошибка возникать только при обращении к ИИ.
        self._client: genai.Client | None = None

    def _get_client(self) -> genai.Client:
        """Возвращает SDK-клиент, создавая его при первом вызове."""
        if not self._api_key:
            raise AIUnavailableError("ИИ-сервис не настроен: не задан GEMINI_API_KEY.")
        if self._client is None:
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    def _map_api_error(self, exc: genai_errors.APIError) -> Exception:
        """Переводит ошибку Gemini в ошибку приложения с понятной причиной.

        В лог пишется только код и текст ответа Google: в них нет данных пользователя,
        зато по ним видно, почему отклонён ключ или не найдена модель.
        """
        logger.warning("Gemini API error %s %s: %s", exc.code, exc.status, exc.message)
        if exc.code == HTTP_TOO_MANY_REQUESTS:
            return AIQuotaExceededError("Лимит бесплатных запросов к ИИ на сегодня исчерпан.")
        if exc.code in KEY_REJECTED_CODES:
            return AIUnavailableError(
                f"Google отклонил ключ Gemini (код {exc.code}). "
                "Проверьте GEMINI_API_KEY в настройках сервера."
            )
        if exc.code == HTTP_NOT_FOUND:
            return AIUnavailableError(
                f"Модель {self._model} недоступна для этого ключа. Проверьте GEMINI_MODEL."
            )
        return AIUnavailableError(f"ИИ-сервис ответил ошибкой {exc.code}.")

    async def generate_json[T: BaseModel](
        self, system: str, messages: list[Message], schema: type[T]
    ) -> tuple[T, str, Usage]:
        """Отправляет диалог в Gemini и требует ответ в JSON по схеме."""
        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=self._temperature,
            response_mime_type="application/json",
            response_schema=schema,
        )
        contents = [
            types.Content(role=message.role, parts=[types.Part(text=message.text)])
            for message in messages
        ]
        try:
            response = await self._get_client().aio.models.generate_content(
                model=self._model, contents=contents, config=config
            )
        except genai_errors.APIError as exc:
            raise self._map_api_error(exc) from exc

        text = response.text or ""
        try:
            parsed = schema.model_validate_json(text)
        except ValidationError as exc:
            raise AIInvalidResponseError("Ответ модели не соответствует схеме.") from exc

        meta = response.usage_metadata
        usage = Usage(
            input_tokens=(meta.prompt_token_count or 0) if meta else 0,
            output_tokens=(meta.candidates_token_count or 0) if meta else 0,
        )
        return parsed, text, usage
