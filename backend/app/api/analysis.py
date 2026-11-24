"""Эндпоинты анализа фигуры."""

from fastapi import APIRouter

from app.schemas.body import BodyAnalysisOut, MeasurementsIn
from app.services.body_analysis import analyze_body

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("/body", response_model=BodyAnalysisOut, summary="Тип фигуры по меркам")
def body_analysis(measurements: MeasurementsIn) -> BodyAnalysisOut:
    """Определяет тип фигуры. Мерки используются только для ответа и не сохраняются."""
    return analyze_body(measurements)
