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


class Occasion(StrEnum):
    """Повод, под который собирается капсула."""

    EVERYDAY = "everyday"
    WORK = "work"
    STUDY = "study"
    DATE = "date"
    PARTY = "party"
    TRAVEL = "travel"


class Slot(StrEnum):
    """Место вещи в образе: верх, низ, платье или верхняя одежда."""

    TOP = "top"
    BOTTOM = "bottom"
    DRESS = "dress"
    OUTER = "outer"


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
    HEIGHT = "height"


class BodyType(StrEnum):
    """Тип фигуры по соотношению обхватов груди, талии и бёдер."""

    HOURGLASS = "hourglass"
    TRIANGLE = "triangle"
    INVERTED_TRIANGLE = "inverted_triangle"
    RECTANGLE = "rectangle"
    OVAL = "oval"


class Fit(StrEnum):
    """Как вещь сидит в зоне: свободно, в самый раз или тесно."""

    LOOSE = "loose"
    GOOD = "good"
    TIGHT = "tight"


class Confidence(StrEnum):
    """Насколько уверенно подобран размер."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# Какие зоны обхватов важны для посадки каждой категории.
# Рост учитывается дополнительно, если он указан в размерной сетке.
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


# Место каждой категории в образе. Образ = верх + низ или платье, плюс по желанию верхняя одежда.
CATEGORY_SLOT: dict[Category, Slot] = {
    Category.TSHIRT: Slot.TOP,
    Category.SHIRT: Slot.TOP,
    Category.HOODIE: Slot.TOP,
    Category.JACKET: Slot.OUTER,
    Category.TROUSERS: Slot.BOTTOM,
    Category.JEANS: Slot.BOTTOM,
    Category.SKIRT: Slot.BOTTOM,
    Category.DRESS: Slot.DRESS,
}
