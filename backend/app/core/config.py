"""Настройки приложения из переменных окружения.

Все секреты и адреса читаются только отсюда. В коде не должно быть
захардкоженных ключей, путей к БД или доменов.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Корень backend/: от него считаются относительные пути по умолчанию.
BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Конфигурация сервиса. Значения берутся из окружения или файла .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Путь к файлу SQLite с каталогом. Файл собирается скриптом scripts/import_catalog.py.
    catalog_db_path: Path = Field(default=BACKEND_DIR / "catalog.db")

    # Ключ и модель Claude API. Ключ нужен только эндпоинтам ИИ.
    anthropic_api_key: str = Field(default="")
    claude_model: str = Field(default="claude-opus-5-5")

    # Домены фронтенда, которым разрешены запросы (через запятую).
    cors_origins: str = Field(default="http://localhost:5173")

    # Сколько бесплатных генераций капсулы в сутки на один анонимный ID.
    free_capsules_per_day: int = Field(default=5, ge=1)

    # Общий лимит частоты запросов к API в формате slowapi, например "30/minute".
    rate_limit: str = Field(default="30/minute")

    @property
    def cors_origin_list(self) -> list[str]:
        """Список разрешённых доменов без пустых значений и пробелов."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Возвращает единственный экземпляр настроек (кэшируется на время жизни процесса)."""
    return Settings()
