"""Обезличенная статистика запросов к ИИ: для раздела «Экономика» и тестирования.

Хранится в памяти процесса: тип запроса, статус, время ответа и токены.
Никаких мерок, ID клиентов, IP или содержимого запросов.
"""

import threading
from dataclasses import dataclass, field

from pydantic import BaseModel


class AIStats(BaseModel):
    """Сводка по запросам к ИИ с момента запуска сервера."""

    requests: int
    succeeded: int
    failed: int
    retries: int
    avg_latency_ms: float
    input_tokens: int
    output_tokens: int


@dataclass
class AIMetrics:
    """Потокобезопасные счётчики запросов к ИИ."""

    _lock: threading.Lock = field(default_factory=threading.Lock)
    _requests: int = 0
    _succeeded: int = 0
    _retries: int = 0
    _latency_ms_total: float = 0.0
    _input_tokens: int = 0
    _output_tokens: int = 0

    def record(
        self, ok: bool, latency_ms: float, attempts: int, input_tokens: int, output_tokens: int
    ) -> None:
        """Учитывает один запрос к стилисту."""
        with self._lock:
            self._requests += 1
            self._succeeded += int(ok)
            self._retries += max(attempts - 1, 0)
            self._latency_ms_total += latency_ms
            self._input_tokens += input_tokens
            self._output_tokens += output_tokens

    def snapshot(self) -> AIStats:
        """Возвращает текущую сводку."""
        with self._lock:
            return AIStats(
                requests=self._requests,
                succeeded=self._succeeded,
                failed=self._requests - self._succeeded,
                retries=self._retries,
                avg_latency_ms=round(self._latency_ms_total / self._requests, 1)
                if self._requests
                else 0.0,
                input_tokens=self._input_tokens,
                output_tokens=self._output_tokens,
            )
