"""Эндпоинты ИИ-стилиста."""

import time
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.ai.client import LLMClient
from app.ai.errors import AIInvalidResponseError, AIQuotaExceededError, AIUnavailableError
from app.core.db import get_session
from app.schemas.stylist import CapsuleOut, CapsuleRequest
from app.services.candidates import NotEnoughCandidatesError
from app.services.limits import DailyLimiter, DailyLimitExceededError, InvalidClientIdError
from app.services.metrics import AIMetrics, AIStats
from app.services.stylist import build_capsule

router = APIRouter(prefix="/stylist", tags=["stylist"])


def get_llm(request: Request) -> LLMClient:
    """ИИ-клиент приложения (в тестах подменяется)."""
    llm: LLMClient = request.app.state.llm
    return llm


def get_limiter(request: Request) -> DailyLimiter:
    """Суточный лимит бесплатных капсул."""
    limiter: DailyLimiter = request.app.state.daily_limiter
    return limiter


def get_metrics(request: Request) -> AIMetrics:
    """Обезличенная статистика запросов к ИИ."""
    metrics: AIMetrics = request.app.state.ai_metrics
    return metrics


@router.post("/capsule", response_model=CapsuleOut, summary="Капсульный гардероб от ИИ")
async def capsule(
    body: CapsuleRequest,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    llm: Annotated[LLMClient, Depends(get_llm)],
    limiter: Annotated[DailyLimiter, Depends(get_limiter)],
    metrics: Annotated[AIMetrics, Depends(get_metrics)],
    x_client_id: Annotated[str | None, Header()] = None,
) -> CapsuleOut:
    """Собирает капсулу из каталога под мерки, стиль, повод и бюджет.

    Каждый вызов списывает одну бесплатную генерацию. Если подбор не удался
    не по вине пользователя (нет вещей, сбой ИИ), генерация возвращается.
    """
    try:
        remaining = limiter.consume(x_client_id)
    except InvalidClientIdError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except DailyLimitExceededError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc)) from exc

    started = time.perf_counter()
    try:
        result = await build_capsule(session, body, llm)
    except NotEnoughCandidatesError as exc:
        limiter.refund(x_client_id)
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    except (AIUnavailableError, AIQuotaExceededError, AIInvalidResponseError) as exc:
        limiter.refund(x_client_id)
        metrics.record(False, (time.perf_counter() - started) * 1000, 1, 0, 0)
        code = (
            status.HTTP_502_BAD_GATEWAY
            if isinstance(exc, AIInvalidResponseError)
            else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        raise HTTPException(code, str(exc)) from exc

    metrics.record(
        True,
        (time.perf_counter() - started) * 1000,
        result.attempts,
        result.usage.input_tokens,
        result.usage.output_tokens,
    )
    response.headers["X-Capsules-Remaining"] = str(remaining)
    return result.capsule


@router.get("/stats", response_model=AIStats, summary="Обезличенная статистика ИИ")
def stats(metrics: Annotated[AIMetrics, Depends(get_metrics)]) -> AIStats:
    """Число запросов, ошибок, повторов, среднее время ответа и токены с момента запуска."""
    return metrics.snapshot()
