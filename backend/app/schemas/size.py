"""Схемы запроса и ответа подбора размера."""

from pydantic import BaseModel, ConfigDict, Field

from app.core.vocab import BodyZone, Confidence, Fit
from app.schemas.body import MeasurementsIn


class SizeRequest(BaseModel):
    """Запрос: какой товар и для каких мерок подобрать размер."""

    model_config = ConfigDict(extra="forbid")

    product_id: int = Field(gt=0)
    measurements: MeasurementsIn


class ZoneFit(BaseModel):
    """Посадка в одной зоне тела для одного размера."""

    zone: BodyZone
    body_cm: float = Field(description="Мерка пользователя")
    size_min_cm: float = Field(description="Нижняя граница размера по сетке")
    size_max_cm: float = Field(description="Верхняя граница размера по сетке")
    excess_cm: float = Field(
        description=(
            "На сколько мерка выходит за допуск размера: >0 — тесно, <0 — свободно, 0 — в норме"
        )
    )
    fit: Fit


class SizeOption(BaseModel):
    """Оценка одного размера из сетки."""

    size_label: str
    size_order: int
    zones: list[ZoneFit]
    score: float = Field(description="Штраф несоответствия: чем меньше, тем лучше")


class SizeRecommendation(BaseModel):
    """Рекомендованный размер, уверенность и оценка всех размеров для сравнения."""

    product_id: int
    recommended: SizeOption
    confidence: Confidence
    note: str = Field(description="Пояснение для пользователя")
    options: list[SizeOption] = Field(description="Все размеры сетки, от меньшего к большему")
