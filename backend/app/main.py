"""Точка входа FastAPI-приложения StyleIt AI."""

from fastapi import FastAPI

from app.api import catalog, health
from app.core.config import Settings, get_settings
from app.core.security import install_security


def create_app(settings: Settings | None = None) -> FastAPI:
    """Собирает приложение: подключает защиту и все роутеры.

    Настройки можно передать явно (так делают тесты), иначе они читаются
    из окружения.
    """
    settings = settings or get_settings()
    app = FastAPI(
        title="StyleIt AI API",
        version="0.1.0",
        description="ИИ-стилист и подбор размера по меркам. Персональные данные не хранятся.",
    )
    install_security(app, settings)
    app.include_router(health.router)
    app.include_router(catalog.router)
    return app


app = create_app()
