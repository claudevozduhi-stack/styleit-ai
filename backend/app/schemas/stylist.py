"""Схемы капсульного гардероба: запрос пользователя, ответ ИИ и итоговый ответ API."""

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.vocab import BodyType, Confidence, Occasion, Style
from app.schemas.body import MeasurementsIn
from app.schemas.catalog import ProductOut

HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


class CapsuleRequest(BaseModel):
    """Запрос пользователя. Свободного текста нет: в промпт попадают только значения из списков."""

    model_config = ConfigDict(extra="forbid")

    measurements: MeasurementsIn
    style: Style
    occasion: Occasion
    budget_kzt: int = Field(ge=5_000, le=2_000_000, description="Бюджет на всю капсулу")
    palette_hex: list[str] = Field(
        default_factory=list, max_length=12, description="Цвета, которые идут пользователю"
    )

    @field_validator("palette_hex")
    @classmethod
    def check_palette(cls, colors: list[str]) -> list[str]:
        """Каждый цвет в формате #RRGGBB."""
        for color in colors:
            if not HEX_COLOR.match(color):
                raise ValueError(f"цвет {color!r} должен быть в формате #RRGGBB")
        return [color.lower() for color in colors]


# --- Схема ответа модели. Gemini обязан вернуть JSON ровно такой формы. ---


class AiLook(BaseModel):
    """Один образ в ответе модели: только ID товаров из списка кандидатов."""

    title: str = Field(description="Короткое название образа, 2–5 слов")
    item_ids: list[int] = Field(description="ID товаров образа из списка кандидатов")
    explanation: str = Field(description="1–3 предложения: почему образ подходит фигуре и поводу")


class AiCapsule(BaseModel):
    """Ответ модели целиком."""

    looks: list[AiLook] = Field(description="От 1 до 4 образов")
    summary: str = Field(description="1–2 предложения о капсуле в целом")
    fit_advice: str = Field(description="1–2 совета по силуэтам для этого типа фигуры")


# --- Итоговый ответ API. ---


class LookItemOut(BaseModel):
    """Вещь в образе с рекомендованным размером."""

    product: ProductOut
    recommended_size: str
    size_confidence: Confidence
    size_note: str


class LookOut(BaseModel):
    """Образ в ответе API."""

    title: str
    explanation: str
    items: list[LookItemOut]
    total_kzt: int


class EstimateOut(BaseModel):
    """Смета капсулы: каждая вещь считается один раз, даже если входит в несколько образов."""

    items_count: int
    total_kzt: int
    budget_kzt: int
    remaining_kzt: int
    within_budget: bool


class CapsuleOut(BaseModel):
    """Капсула: образы, смета и советы."""

    body_type: BodyType
    body_type_title: str
    looks: list[LookOut]
    summary: str
    fit_advice: str
    estimate: EstimateOut
    disclaimer: str
