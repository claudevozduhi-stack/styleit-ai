"""Эндпоинт подбора размера."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.schemas.size import SizeRecommendation, SizeRequest
from app.services.size_service import ProductNotFoundError, SizeChartMissingError, recommend_size

router = APIRouter(prefix="/size", tags=["size"])


@router.post("/recommend", response_model=SizeRecommendation, summary="Размер товара по меркам")
def size_recommend(
    request: SizeRequest, session: Annotated[Session, Depends(get_session)]
) -> SizeRecommendation:
    """Подбирает размер по сетке бренда и оценивает посадку по зонам для всех размеров."""
    try:
        return recommend_size(session, request.product_id, request.measurements)
    except ProductNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Товар не найден в каталоге") from exc
    except SizeChartMissingError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Для этого товара нет размерной сетки"
        ) from exc
