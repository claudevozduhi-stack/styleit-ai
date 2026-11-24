"""Проверка работоспособности для хостинга и мониторинга."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthOut(BaseModel):
    """Ответ проверки работоспособности."""

    status: str


@router.get("/health", response_model=HealthOut, summary="Сервис жив")
def health() -> HealthOut:
    """Возвращает ok, если процесс API запущен и отвечает."""
    return HealthOut(status="ok")
