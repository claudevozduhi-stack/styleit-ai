"""Схемы цветотипа: ответы анкеты и результат."""

import re
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, field_validator

HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


class Undertone(StrEnum):
    """Подтон кожи. В анкете определяется по цвету вен на запястье."""

    WARM = "warm"  # вены зеленоватые
    COOL = "cool"  # вены синие или фиолетовые
    NEUTRAL = "neutral"  # не понятно или и то и другое


class ColorSeason(StrEnum):
    """Сезонный цветотип."""

    SPRING = "spring"
    SUMMER = "summer"
    AUTUMN = "autumn"
    WINTER = "winter"


class ColorAnalysisIn(BaseModel):
    """Цвета кожи, волос и глаз (#RRGGBB) и подтон. Фото на сервер не передаётся."""

    model_config = ConfigDict(extra="forbid")

    undertone: Undertone
    skin_hex: str
    hair_hex: str
    eye_hex: str

    @field_validator("skin_hex", "hair_hex", "eye_hex")
    @classmethod
    def check_hex(cls, value: str) -> str:
        """Цвет в формате #RRGGBB."""
        if not HEX_COLOR.match(value):
            raise ValueError("цвет должен быть в формате #RRGGBB")
        return value.lower()


class ColorAnalysisOut(BaseModel):
    """Цветотип и палитра рекомендуемых цветов одежды."""

    season: ColorSeason
    title: str
    explanation: str
    palette_hex: list[str]
    avoid_hex: list[str]
