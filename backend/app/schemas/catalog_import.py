"""Схемы строк CSV каталога. Каждая строка проверяется до записи в БД.

Ошибки содержат номер строки и файл, чтобы команде было легко исправить таблицу.
"""

import re
from datetime import date
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from app.core.vocab import Category, Gender, Season, Style

HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


class StoreRow(BaseModel):
    """Строка stores.csv."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)
    url: HttpUrl
    collected_at: date


class SizeChartRow(BaseModel):
    """Строка size_charts.csv: один размер одного бренда в одной категории."""

    model_config = ConfigDict(str_strip_whitespace=True)

    store: str = Field(min_length=1)
    brand: str = Field(min_length=1, max_length=120)
    category: Category
    gender: Gender
    size_label: str = Field(min_length=1, max_length=20)
    size_order: int = Field(ge=1, le=30)
    chest_min: float | None = Field(default=None, ge=50, le=200)
    chest_max: float | None = Field(default=None, ge=50, le=200)
    waist_min: float | None = Field(default=None, ge=40, le=200)
    waist_max: float | None = Field(default=None, ge=40, le=200)
    hips_min: float | None = Field(default=None, ge=50, le=200)
    hips_max: float | None = Field(default=None, ge=50, le=200)
    height_min: float | None = Field(default=None, ge=120, le=220)
    height_max: float | None = Field(default=None, ge=120, le=220)

    @field_validator("*", mode="before")
    @classmethod
    def empty_to_none(cls, value: object) -> object:
        """Пустая ячейка CSV означает «нет значения»."""
        if isinstance(value, str) and value.strip() == "":
            return None
        return value

    @model_validator(mode="after")
    def check_ranges(self) -> Self:
        """У каждой зоны либо обе границы, либо ни одной, и min не больше max."""
        pairs = {
            "chest": (self.chest_min, self.chest_max),
            "waist": (self.waist_min, self.waist_max),
            "hips": (self.hips_min, self.hips_max),
            "height": (self.height_min, self.height_max),
        }
        for zone, (low, high) in pairs.items():
            if (low is None) != (high is None):
                raise ValueError(f"{zone}: нужно заполнить обе границы или ни одной")
            if low is not None and high is not None and low > high:
                raise ValueError(f"{zone}: минимум {low} больше максимума {high}")
        if all(low is None for low, _ in pairs.values()):
            raise ValueError("в строке нет ни одного диапазона мерок")
        return self


class ProductRow(BaseModel):
    """Строка products.csv: один товар магазина."""

    model_config = ConfigDict(str_strip_whitespace=True)

    store: str = Field(min_length=1)
    brand: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    category: Category
    gender: Gender
    price_kzt: int = Field(gt=0, le=10_000_000)
    color_name: str = Field(min_length=1, max_length=60)
    color_hex: str
    style_tags: list[Style] = Field(min_length=1)
    season: Season
    product_url: HttpUrl
    collected_at: date

    @field_validator("style_tags", mode="before")
    @classmethod
    def split_tags(cls, value: object) -> object:
        """В CSV теги пишутся через запятую: "casual,office"."""
        if isinstance(value, str):
            return [tag.strip() for tag in value.split(",") if tag.strip()]
        return value

    @field_validator("color_hex")
    @classmethod
    def check_hex(cls, value: str) -> str:
        """Цвет в формате #RRGGBB, приводится к нижнему регистру."""
        if not HEX_COLOR.match(value):
            raise ValueError("цвет должен быть в формате #RRGGBB, например #1f2a44")
        return value.lower()
