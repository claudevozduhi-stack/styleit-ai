"""Схемы мерок тела и результата анализа фигуры.

Мерки приходят в теле запроса только для расчёта и нигде не сохраняются.
Диапазоны совпадают с проверкой на фронтенде (frontend/src/types/body.ts).
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.vocab import BodyType


class MeasurementsIn(BaseModel):
    """Мерки тела в сантиметрах и килограммах."""

    model_config = ConfigDict(extra="forbid")

    gender: Literal["female", "male"]
    height_cm: float = Field(ge=120, le=220)
    weight_kg: float = Field(ge=30, le=250)
    chest_cm: float = Field(ge=50, le=200)
    waist_cm: float = Field(ge=40, le=200)
    hips_cm: float = Field(ge=50, le=200)
    shoulders_cm: float | None = Field(default=None, ge=25, le=70)
    inseam_cm: float | None = Field(default=None, ge=50, le=110)


class BodyAnalysisOut(BaseModel):
    """Тип фигуры и числовые показатели, на которых он основан."""

    body_type: BodyType
    title: str = Field(description="Название типа фигуры по-русски")
    explanation: str = Field(description="Почему определён этот тип, простыми словами")
    bmi: float = Field(description="Индекс массы тела, справочно")
    waist_to_hip: float = Field(description="Отношение талии к бёдрам")
    chest_minus_hips_cm: float
    chest_minus_waist_cm: float
    hips_minus_waist_cm: float
