"""Точка входа FastAPI-приложения StyleIt AI."""

from fastapi import FastAPI

from app.ai.client import LLMClient
from app.ai.factory import build_llm
from app.api import analysis, catalog, health, size, stylist
from app.core.config import Settings, get_settings
from app.core.security import install_security
from app.services.limits import DailyLimiter
from app.services.metrics import AIMetrics


def create_app(settings: Settings | None = None, llm: LLMClient | None = None) -> FastAPI:
    """Собирает приложение: подключает защиту, ИИ-клиент, лимиты и все роутеры.

    Настройки и ИИ-клиент можно передать явно (так делают тесты), иначе
    настройки читаются из окружения, а клиент выбирается настройкой AI_PROVIDER.
    """
    settings = settings or get_settings()
    app = FastAPI(
        title="StyleIt AI API",
        version="0.1.0",
        description="ИИ-стилист и подбор размера по меркам. Персональные данные не хранятся.",
    )
    install_security(app, settings)
    app.state.llm = llm or build_llm(settings)
    app.state.daily_limiter = DailyLimiter(settings.free_capsules_per_day)
    app.state.ai_metrics = AIMetrics()
    app.include_router(health.router)
    app.include_router(catalog.router)
    app.include_router(analysis.router)
    app.include_router(size.router)
    app.include_router(stylist.router)
    return app


app = create_app()
