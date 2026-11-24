"""Общие справочники: категории одежды, пол, стили, сезоны.

Одни и те же значения используются в CSV каталога, в API и в промптах,
поэтому они собраны в одном месте.
"""

from enum import StrEnum


class Gender(StrEnum):
    """Для кого предназначена вещь."""

    FEMALE = "female"
    MALE = "male"
    UNISEX = "unisex"


class Category(StrEnum):
    """Категория одежды. Определяет зоны посадки и 3D-форму вещи."""

    TSHIRT = "tshirt"
    SHIRT = "shirt"
    HOODIE = "hoodie"
    JACKET = "jacket"
    TROUSERS = "trousers"
    JEANS = "jeans"
    SKIRT = "skirt"
    DRESS = "dress"


class Style(StrEnum):
    """Стиль образа, который выбирает пользователь."""

    CASUAL = "casual"
    OFFICE = "office"
    SPORT = "sport"
    EVENING = "evening"
    STREET = "street"


class Season(StrEnum):
    """Сезон носки вещи."""

    SUMMER = "summer"
    DEMI = "demi"
    WINTER = "winter"
    ALL = "all"


class BodyZone(StrEnum):
    """Зона тела, по которой сравниваются мерки и размерная сетка."""

    CHEST = "chest"
    WAIST = "waist"
    HIPS = "hips"


# Какие зоны важны для посадки каждой категории.
CATEGORY_ZONES: dict[Category, tuple[BodyZone, ...]] = {
    Category.TSHIRT: (BodyZone.CHEST, BodyZone.WAIST),
    Category.SHIRT: (BodyZone.CHEST, BodyZone.WAIST),
    Category.HOODIE: (BodyZone.CHEST, BodyZone.WAIST),
    Category.JACKET: (BodyZone.CHEST, BodyZone.WAIST),
    Category.TROUSERS: (BodyZone.WAIST, BodyZone.HIPS),
    Category.JEANS: (BodyZone.WAIST, BodyZone.HIPS),
    Category.SKIRT: (BodyZone.WAIST, BodyZone.HIPS),
    Category.DRESS: (BodyZone.CHEST, BodyZone.WAIST, BodyZone.HIPS),
}
