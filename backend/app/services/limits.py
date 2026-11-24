"""Freemium-лимит: N бесплатных капсул в сутки на анонимный ID браузера.

ID — случайный UUID, который генерирует браузер; он не связан с личностью.
На сервере хранится только его хэш и счётчик, в памяти процесса, до конца
суток (по UTC). На диск и в логи ничего не пишется.
"""

import hashlib
import threading
import uuid
from datetime import UTC, date, datetime


class InvalidClientIdError(ValueError):
    """Заголовок X-Client-Id отсутствует или не похож на UUID."""


class DailyLimitExceededError(RuntimeError):
    """Бесплатные генерации на сегодня закончились."""


class DailyLimiter:
    """Потокобезопасный счётчик запросов на ID в течение суток."""

    def __init__(self, per_day: int) -> None:
        self._per_day = per_day
        self._day: date | None = None
        self._counts: dict[str, int] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _key(client_id: str | None) -> str:
        """Проверяет ID и возвращает его хэш — сам ID в памяти не держим."""
        try:
            parsed = uuid.UUID(client_id or "")
        except ValueError as exc:
            raise InvalidClientIdError("Нужен заголовок X-Client-Id в формате UUID.") from exc
        return hashlib.sha256(parsed.bytes).hexdigest()

    def consume(self, client_id: str | None, today: date | None = None) -> int:
        """Списывает одну генерацию и возвращает, сколько осталось на сегодня."""
        key = self._key(client_id)
        today = today or datetime.now(UTC).date()
        with self._lock:
            if self._day != today:
                self._day, self._counts = today, {}
            used = self._counts.get(key, 0)
            if used >= self._per_day:
                raise DailyLimitExceededError(
                    f"Бесплатный лимит — {self._per_day} капсул в сутки. Возвращайтесь завтра."
                )
            self._counts[key] = used + 1
            return self._per_day - used - 1

    def refund(self, client_id: str | None, today: date | None = None) -> None:
        """Возвращает генерацию, если подбор не удался не по вине пользователя."""
        key = self._key(client_id)
        today = today or datetime.now(UTC).date()
        with self._lock:
            if self._day == today and self._counts.get(key, 0) > 0:
                self._counts[key] -= 1
