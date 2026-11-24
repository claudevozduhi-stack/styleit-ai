"""Эндпоинты анализа фигуры."""

from fastapi import APIRouter

from app.schemas.body import BodyAnalysisOut, MeasurementsIn
from app.schemas.color import ColorAnalysisIn, ColorAnalysisOut
from app.services.body_analysis import analyze_body
from app.services.color_analysis import analyze_color

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("/body", response_model=BodyAnalysisOut, summary="Тип фигуры по меркам")
def body_analysis(measurements: MeasurementsIn) -> BodyAnalysisOut:
    """Определяет тип фигуры. Мерки используются только для ответа и не сохраняются."""
    return analyze_body(measurements)


@router.post("/color", response_model=ColorAnalysisOut, summary="Цветотип по анкете")
def color_analysis(data: ColorAnalysisIn) -> ColorAnalysisOut:
    """Определяет сезонный цветотип по подтону и цветам кожи, волос и глаз."""
    return analyze_color(data)
