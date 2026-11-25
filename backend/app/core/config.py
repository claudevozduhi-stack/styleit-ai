"""Настройки приложения из переменных окружения.

Все секреты и адреса читаются только отсюда. В коде не должно быть
захардкоженных ключей, путей к БД или доменов.
"""

import re
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Корень backend/: от него считаются относительные пути по умолчанию.
BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Конфигурация сервиса. Значения берутся из окружения или файла .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Путь к файлу SQLite с каталогом. Файл собирается скриптом scripts/import_catalog.py.
    catalog_db_path: Path = Field(default=BACKEND_DIR / "catalog.db")

    # Ключ и модель Gemini API (бесплатный тариф Google AI Studio). Нужен только эндпоинтам ИИ.
    gemini_api_key: str = Field(default="")
    gemini_model: str = Field(default="gemini-3.5-flash")

    # Домены фронтенда, которым разрешены запросы (через запятую).
    cors_origins: str = Field(default="http://localhost:5173")

    # Регулярное выражение для превью-деплоев фронтенда, у которых адрес меняется с каждой веткой
    # (например, Vercel Preview). Пусто — превью не разрешены. Сравнивается со всем Origin целиком.
    cors_origin_regex: str = Field(default="")

    # Сколько бесплатных генераций капсулы в сутки на один анонимный ID.
    free_capsules_per_day: int = Field(default=5, ge=1)

    # Общий лимит частоты запросов к API в формате slowapi, например "30/minute".
    rate_limit: str = Field(default="30/minute")

    @field_validator("cors_origin_regex")
    @classmethod
    def _check_regex(cls, value: str) -> str:
        """Проверяет выражение при старте, чтобы опечатка не всплыла только на запросе."""
        try:
            re.compile(value)
        except re.error as error:
            raise ValueError(
                f"CORS_ORIGIN_REGEX — неверное регулярное выражение: {error}"
            ) from error
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        """Список разрешённых доменов без пустых значений и пробелов."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Возвращает единственный экземпляр настроек (кэшируется на время жизни процесса)."""
    return Settings()
