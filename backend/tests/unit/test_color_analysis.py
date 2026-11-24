"""Проверки определения цветотипа."""

import pytest

from app.schemas.color import ColorAnalysisIn, ColorSeason, Undertone
from app.services.color_analysis import analyze_color

LIGHT_SKIN, MEDIUM_SKIN = "#f1d3c2", "#c68c63"
BLOND, BROWN, BLACK = "#d8b26e", "#5a3a22", "#1b1612"


@pytest.mark.parametrize(
    ("undertone", "skin", "hair", "expected"),
    [
        (Undertone.WARM, LIGHT_SKIN, BLOND, ColorSeason.SPRING),
        (Undertone.WARM, MEDIUM_SKIN, BLACK, ColorSeason.AUTUMN),
        (Undertone.COOL, LIGHT_SKIN, BLOND, ColorSeason.SUMMER),
        (Undertone.COOL, LIGHT_SKIN, BLACK, ColorSeason.WINTER),
        (Undertone.NEUTRAL, LIGHT_SKIN, BLACK, ColorSeason.WINTER),
        (Undertone.NEUTRAL, LIGHT_SKIN, BLOND, ColorSeason.SUMMER),
    ],
)
def test_seasons(undertone: Undertone, skin: str, hair: str, expected: ColorSeason) -> None:
    data = ColorAnalysisIn(undertone=undertone, skin_hex=skin, hair_hex=hair, eye_hex="#4a6b8a")
    result = analyze_color(data)
    assert result.season == expected
    assert len(result.palette_hex) == 8
