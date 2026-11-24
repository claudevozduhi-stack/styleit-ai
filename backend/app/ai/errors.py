"""Ошибки обращения к ИИ-сервису, понятные остальному коду и пользователю."""


class AIUnavailableError(RuntimeError):
    """ИИ-сервис недоступен: нет ключа, сетевая ошибка или сбой на стороне Google."""


class AIQuotaExceededError(RuntimeError):
    """Исчерпан лимит бесплатного тарифа Gemini (общий на весь проект)."""


class AIInvalidResponseError(RuntimeError):
    """Модель вернула ответ, который не удалось разобрать по схеме."""
