"""Подменная языковая модель для тестов: отдаёт заранее заданные ответы без сети."""

from pydantic import BaseModel

from app.ai.client import Message, Usage
from app.ai.errors import AIUnavailableError


class FakeLLM:
    """Возвращает ответы из очереди и запоминает, что ей отправили."""

    def __init__(self, responses: list[BaseModel] | None = None, fail: bool = False) -> None:
        self.responses = list(responses or [])
        self.fail = fail
        self.calls: list[tuple[str, list[Message]]] = []

    async def generate_json[T: BaseModel](
        self, system: str, messages: list[Message], schema: type[T]
    ) -> tuple[T, str, Usage]:
        """Отдаёт следующий ответ из очереди, приведённый к запрошенной схеме."""
        self.calls.append((system, list(messages)))
        if self.fail:
            raise AIUnavailableError("ИИ-сервис недоступен (тест).")
        response = self.responses.pop(0)
        parsed = schema.model_validate(response.model_dump())
        return parsed, parsed.model_dump_json(), Usage(input_tokens=100, output_tokens=50)
