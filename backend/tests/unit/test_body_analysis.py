"""Проверки определения типа фигуры."""

import pytest

from app.core.vocab import BodyType
from app.schemas.body import MeasurementsIn
from app.services.body_analysis import analyze_body


def measurements(chest: float, waist: float, hips: float, gender: str = "female") -> MeasurementsIn:
    """Мерки с фиксированными ростом и весом, меняются только обхваты."""
    return MeasurementsIn.model_validate(
        {
            "gender": gender,
            "height_cm": 168,
            "weight_kg": 60,
            "chest_cm": chest,
            "waist_cm": waist,
            "hips_cm": hips,
        }
    )


@pytest.mark.parametrize(
    ("chest", "waist", "hips", "gender", "expected"),
    [
        (92, 66, 94, "female", BodyType.HOURGLASS),
        (88, 70, 102, "female", BodyType.TRIANGLE),
        (104, 80, 92, "female", BodyType.INVERTED_TRIANGLE),
        (90, 78, 94, "female", BodyType.RECTANGLE),
        (100, 98, 102, "female", BodyType.OVAL),
        # У мужчин песочные часы не выделяются.
        (96, 72, 97, "male", BodyType.RECTANGLE),
    ],
)
def test_body_types(
    chest: float, waist: float, hips: float, gender: str, expected: BodyType
) -> None:
    assert analyze_body(measurements(chest, waist, hips, gender)).body_type == expected


def test_metrics_are_rounded() -> None:
    result = analyze_body(measurements(92, 66, 94))
    assert result.bmi == 21.3
    assert result.waist_to_hip == 0.7
    assert result.chest_minus_hips_cm == -2.0
    assert result.title == "Песочные часы"
