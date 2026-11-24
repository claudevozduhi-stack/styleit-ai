"""Проверки подбора размера на сетке с точечными значениями (как у Mango)."""

from app.core.vocab import BodyZone, Category, Confidence, Fit
from app.schemas.body import MeasurementsIn
from app.services.size_engine import SizeRow, describe, evaluate_sizes, pick_best

# Сетка с одним числом на размер: грудь / талия / бёдра.
POINT_CHART = [
    SizeRow("S", 3, {BodyZone.CHEST: (86, 86), BodyZone.WAIST: (66, 66), BodyZone.HIPS: (94, 94)}),
    SizeRow(
        "M", 4, {BodyZone.CHEST: (92, 92), BodyZone.WAIST: (72, 72), BodyZone.HIPS: (100, 100)}
    ),
    SizeRow(
        "L", 5, {BodyZone.CHEST: (98, 98), BodyZone.WAIST: (78, 78), BodyZone.HIPS: (106, 106)}
    ),
]

# Сетка с диапазонами и ростом.
RANGE_CHART = [
    SizeRow(
        "S", 1, {BodyZone.CHEST: (86, 92), BodyZone.WAIST: (70, 76), BodyZone.HEIGHT: (164, 170)}
    ),
    SizeRow(
        "M", 2, {BodyZone.CHEST: (92, 98), BodyZone.WAIST: (76, 82), BodyZone.HEIGHT: (170, 176)}
    ),
]


def body(chest: float, waist: float, hips: float, height: float = 168) -> MeasurementsIn:
    """Мерки для теста."""
    return MeasurementsIn.model_validate(
        {
            "gender": "female",
            "height_cm": height,
            "weight_kg": 60,
            "chest_cm": chest,
            "waist_cm": waist,
            "hips_cm": hips,
        }
    )


def recommend(chart: list[SizeRow], m: MeasurementsIn, category: Category = Category.TSHIRT):
    """Возвращает лучший размер, уверенность и все варианты."""
    options = evaluate_sizes(category, chart, m)
    best = pick_best(options)
    confidence, note = describe(best, options)
    return best, confidence, note, options


def test_exact_match_is_high_confidence() -> None:
    best, confidence, _, _ = recommend(POINT_CHART, body(92, 72, 100))
    assert best.size_label == "M"
    assert confidence == Confidence.HIGH
    assert all(zone.fit == Fit.GOOD for zone in best.zones)


def test_between_sizes_is_covered_by_tolerance() -> None:
    # Грудь 89 — ровно посередине между S (86) и M (92): допуск 3 см покрывает оба.
    best, confidence, _, _ = recommend(POINT_CHART, body(89, 69, 97))
    assert confidence == Confidence.HIGH
    # При равенстве выбирается больший размер — свободнее, а не теснее.
    assert best.size_label == "M"


def test_tshirt_ignores_hips() -> None:
    best, _, _, _ = recommend(POINT_CHART, body(86, 66, 120))
    assert best.size_label == "S"
    assert {zone.zone for zone in best.zones} == {BodyZone.CHEST, BodyZone.WAIST}


def test_trousers_use_waist_and_hips() -> None:
    best, _, _, _ = recommend(POINT_CHART, body(120, 72, 100), Category.TROUSERS)
    assert best.size_label == "M"


def test_too_big_body_gets_low_confidence_and_tight_fit() -> None:
    best, confidence, note, _ = recommend(POINT_CHART, body(115, 95, 120))
    assert best.size_label == "L"
    assert confidence == Confidence.LOW
    assert best.zones[0].fit == Fit.TIGHT
    assert "нет в сетке" in note


def test_tight_is_penalized_more_than_loose() -> None:
    options = evaluate_sizes(Category.TSHIRT, POINT_CHART, body(96, 75, 100))
    by_label = {option.size_label: option for option in options}
    # Грудь 96: на 1 см выше допуска M (92+3) и на 1 см ниже допуска L (98-3) — L в норме.
    assert by_label["M"].zones[0].fit == Fit.TIGHT
    assert pick_best(options).size_label == "L"


def test_height_is_considered_with_lower_weight() -> None:
    best, _, _, options = recommend(RANGE_CHART, body(92, 76, 94, height=180))
    assert len(options) == 2
    assert BodyZone.HEIGHT in {zone.zone for zone in best.zones}
    assert best.size_label == "M"


def test_options_are_sorted_small_to_large() -> None:
    _, _, _, options = recommend(POINT_CHART, body(92, 72, 100))
    assert [option.size_label for option in options] == ["S", "M", "L"]
