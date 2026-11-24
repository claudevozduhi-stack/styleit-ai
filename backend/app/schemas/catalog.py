"""Схемы ответов API каталога."""

from datetime import date

from pydantic import BaseModel, ConfigDict

from app.core.vocab import Category, Gender, Season, Style


class ProductOut(BaseModel):
    """Товар в ответе API. Ссылка ведёт на страницу магазина."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    store: str
    brand: str
    category: Category
    gender: Gender
    price_kzt: int
    color_name: str
    color_hex: str
    style_tags: list[Style]
    season: Season
    product_url: str
    collected_at: date


class CatalogPage(BaseModel):
    """Страница каталога с общим числом найденных товаров."""

    total: int
    items: list[ProductOut]
