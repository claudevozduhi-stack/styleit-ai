"""Определение сезонного цветотипа по подтону и цветам кожи, волос и глаз.

Используется классическая сезонная система: тёплый подтон даёт весну или
осень, холодный — лето или зиму. Между ними выбирают по глубине (насколько
тёмные волосы) и контрасту между волосами и кожей. Нейтральный подтон
решается по контрасту: высокий — зима или осень, мягкий — лето или весна.

Яркость цветов считается в пространстве CIE Lab (L* — воспринимаемая светлота),
а не по RGB, потому что так она ближе к восприятию глазом.

Палитры подготовлены командой (дизайнер) и одинаковы для всех пользователей
одного цветотипа.
"""

from app.schemas.color import ColorAnalysisIn, ColorAnalysisOut, ColorSeason, Undertone
from app.services.color import hex_to_rgb

DARK_HAIR_L = 35.0  # волосы темнее этого L* считаются тёмными
HIGH_CONTRAST_L = 45.0  # разница светлоты кожи и волос выше этой — высокий контраст

PALETTES: dict[ColorSeason, tuple[str, str, list[str], list[str]]] = {
    ColorSeason.SPRING: (
        "Весна",
        "Вам идут чистые тёплые светлые цвета.",
        ["#f6d6a8", "#f4a261", "#e76f51", "#ffd166", "#a7c957", "#76c7c0", "#f2e8cf", "#c8553d"],
        ["#000000", "#4b4b6b", "#7d7d7d"],
    ),
    ColorSeason.SUMMER: (
        "Лето",
        "Вам идут приглушённые прохладные цвета.",
        ["#b8c5d6", "#9aa9c9", "#c9a7c7", "#e8c3c9", "#8fa8a0", "#d9d9d6", "#6b7b8c", "#f4eef0"],
        ["#ff7f11", "#c8553d", "#000000"],
    ),
    ColorSeason.AUTUMN: (
        "Осень",
        "Вам идут глубокие тёплые природные цвета.",
        ["#8c5a3c", "#b5651d", "#d8c3a5", "#6b6b3a", "#a3a380", "#7f3c2d", "#e0a458", "#3f4a3c"],
        ["#ff69b4", "#b8c5d6", "#ffffff"],
    ),
    ColorSeason.WINTER: (
        "Зима",
        "Вам идут чистые яркие и глубокие холодные цвета.",
        ["#000000", "#ffffff", "#1f2a44", "#8b0000", "#4b0082", "#0f5257", "#c0c0c0", "#d7263d"],
        ["#e0a458", "#d8c3a5", "#a3a380"],
    ),
}


def _lightness(color: str) -> float:
    """Светлота L* по CIE Lab (0 — чёрный, 100 — белый) для цвета #RRGGBB."""

    def linear(channel: int) -> float:
        value = channel / 255
        return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4

    red, green, blue = (linear(channel) for channel in hex_to_rgb(color))
    luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    epsilon = 216 / 24389
    kappa = 24389 / 27
    f = luminance ** (1 / 3) if luminance > epsilon else (kappa * luminance + 16) / 116
    return 116 * f - 16


UNDERTONE_TEXT = {
    Undertone.WARM: "Тёплый подтон",
    Undertone.COOL: "Холодный подтон",
    Undertone.NEUTRAL: "Нейтральный подтон",
}


def _features(data: ColorAnalysisIn) -> tuple[bool, bool]:
    """Возвращает (тёмные ли волосы, высокий ли контраст волос и кожи)."""
    hair_l = _lightness(data.hair_hex)
    contrast = abs(_lightness(data.skin_hex) - hair_l)
    return hair_l < DARK_HAIR_L, contrast > HIGH_CONTRAST_L


def classify_season(data: ColorAnalysisIn) -> ColorSeason:
    """Выбирает сезон по подтону, глубине волос и контрасту волос и кожи."""
    is_dark, is_contrast = _features(data)

    if data.undertone == Undertone.WARM:
        return ColorSeason.AUTUMN if is_dark else ColorSeason.SPRING
    if data.undertone == Undertone.COOL:
        return ColorSeason.WINTER if is_dark or is_contrast else ColorSeason.SUMMER
    if is_contrast:
        return ColorSeason.WINTER if is_dark else ColorSeason.AUTUMN
    return ColorSeason.SUMMER if not is_dark else ColorSeason.AUTUMN


def analyze_color(data: ColorAnalysisIn) -> ColorAnalysisOut:
    """Определяет цветотип и возвращает его палитру."""
    season = classify_season(data)
    title, palette_text, palette, avoid = PALETTES[season]
    is_dark, is_contrast = _features(data)
    hair_text = "тёмные волосы" if is_dark else "светлые или средние волосы"
    contrast_text = "высокий контраст" if is_contrast else "мягкий контраст"
    features = f"{UNDERTONE_TEXT[data.undertone]}, {hair_text}, {contrast_text}."
    return ColorAnalysisOut(
        season=season,
        title=title,
        explanation=f"{features} {palette_text}",
        palette_hex=palette,
        avoid_hex=avoid,
    )
