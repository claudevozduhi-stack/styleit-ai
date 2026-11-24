"""Подбор размера по размерной сетке бренда.

Как это работает:
1. Для каждого размера сетки и каждой важной для категории зоны (грудь,
   талия, бёдра, рост) берём диапазон тела, на который рассчитан размер.
2. Сетки часто дают одно число («грудь 92») или диапазоны с промежутками
   между размерами, поэтому к диапазону добавляется допуск: половина шага
   до соседнего размера, но не меньше MIN_TOLERANCE_CM.
3. Если мерка внутри диапазона с допуском — посадка «в самый раз». Выход
   за верхнюю границу — «тесно», за нижнюю — «свободно».
4. Штраф размера — сумма квадратов выходов за допуск. Тесная посадка
   штрафуется сильнее свободной: вещь чуть больше носить можно, меньше — нет.
5. Рекомендуется размер с минимальным штрафом.

Модуль не обращается к БД: на вход подаются строки сетки, что упрощает тесты.
"""

from collections.abc import Sequence
from dataclasses import dataclass

from app.core.vocab import CATEGORY_ZONES, BodyZone, Category, Confidence, Fit
from app.schemas.body import MeasurementsIn
from app.schemas.size import SizeOption, ZoneFit

MIN_TOLERANCE_CM = 1.5  # минимальный допуск вокруг диапазона сетки
MAX_TOLERANCE_CM = 4.0  # допуск не растёт бесконечно при больших шагах сетки
TIGHT_PENALTY = 1.5  # тесно хуже, чем свободно
HEIGHT_WEIGHT = 0.3  # рост влияет на длину, но слабее обхватов
MEDIUM_CONFIDENCE_EXCESS_CM = 3.0  # до этого выхода за допуск уверенность средняя


@dataclass(frozen=True)
class SizeRow:
    """Строка размерной сетки в виде, удобном для расчёта (без привязки к ORM)."""

    size_label: str
    size_order: int
    ranges: dict[BodyZone, tuple[float, float]]


def body_value(m: MeasurementsIn, zone: BodyZone) -> float:
    """Возвращает мерку пользователя для зоны."""
    values = {
        BodyZone.CHEST: m.chest_cm,
        BodyZone.WAIST: m.waist_cm,
        BodyZone.HIPS: m.hips_cm,
        BodyZone.HEIGHT: m.height_cm,
    }
    return values[zone]


def tolerances(rows: Sequence[SizeRow], zone: BodyZone) -> dict[str, float]:
    """Считает допуск зоны для каждого размера: половина шага до ближайшего соседа."""
    with_zone = sorted((r for r in rows if zone in r.ranges), key=lambda r: r.size_order)
    centers = [sum(r.ranges[zone]) / 2 for r in with_zone]
    result: dict[str, float] = {}
    for index, row in enumerate(with_zone):
        steps = [
            abs(centers[index] - centers[neighbor])
            for neighbor in (index - 1, index + 1)
            if 0 <= neighbor < len(with_zone)
        ]
        low, high = row.ranges[zone]
        half_gap = (min(steps) - (high - low)) / 2 if steps else MIN_TOLERANCE_CM
        result[row.size_label] = min(max(half_gap, MIN_TOLERANCE_CM), MAX_TOLERANCE_CM)
    return result


def evaluate_zone(
    zone: BodyZone, value: float, bounds: tuple[float, float], tolerance: float
) -> ZoneFit:
    """Оценивает посадку одной зоны: насколько мерка выходит за диапазон с допуском."""
    low, high = bounds
    if value > high + tolerance:
        excess, fit = value - (high + tolerance), Fit.TIGHT
    elif value < low - tolerance:
        excess, fit = value - (low - tolerance), Fit.LOOSE
    else:
        excess, fit = 0.0, Fit.GOOD
    return ZoneFit(
        zone=zone,
        body_cm=value,
        size_min_cm=low,
        size_max_cm=high,
        excess_cm=round(excess, 1),
        fit=fit,
    )


def zone_penalty(zone_fit: ZoneFit) -> float:
    """Штраф за выход зоны за допуск с учётом веса зоны и направления."""
    weight = HEIGHT_WEIGHT if zone_fit.zone == BodyZone.HEIGHT else 1.0
    direction = TIGHT_PENALTY if zone_fit.fit == Fit.TIGHT else 1.0
    return weight * direction * zone_fit.excess_cm**2


def evaluate_sizes(
    category: Category, rows: Sequence[SizeRow], m: MeasurementsIn
) -> list[SizeOption]:
    """Оценивает каждый размер сетки и возвращает их от меньшего к большему."""
    zones = (*CATEGORY_ZONES[category], BodyZone.HEIGHT)
    zone_tolerances = {zone: tolerances(rows, zone) for zone in zones}
    options: list[SizeOption] = []
    for row in sorted(rows, key=lambda r: r.size_order):
        fits = [
            evaluate_zone(
                zone, body_value(m, zone), row.ranges[zone], zone_tolerances[zone][row.size_label]
            )
            for zone in zones
            if zone in row.ranges
        ]
        score = sum(zone_penalty(fit) for fit in fits)
        options.append(
            SizeOption(
                size_label=row.size_label,
                size_order=row.size_order,
                zones=fits,
                score=round(score, 2),
            )
        )
    return options


def pick_best(options: Sequence[SizeOption]) -> SizeOption:
    """Выбирает размер с минимальным штрафом; при равенстве — больший (свободнее)."""
    return min(options, key=lambda option: (option.score, -option.size_order))


def describe(best: SizeOption, options: Sequence[SizeOption]) -> tuple[Confidence, str]:
    """Определяет уверенность и формирует пояснение для пользователя."""
    off = [zone for zone in best.zones if zone.fit != Fit.GOOD and zone.zone != BodyZone.HEIGHT]
    if not off:
        return Confidence.HIGH, f"Размер {best.size_label} подходит по всем меркам."

    worst = max(off, key=lambda zone: abs(zone.excess_cm))
    zone_names = {
        BodyZone.CHEST: "груди",
        BodyZone.WAIST: "талии",
        BodyZone.HIPS: "бёдрах",
        BodyZone.HEIGHT: "росту",
    }
    word = "плотно" if worst.fit == Fit.TIGHT else "свободно"
    is_edge = best.size_order in (options[0].size_order, options[-1].size_order)
    confidence = (
        Confidence.MEDIUM
        if abs(worst.excess_cm) <= MEDIUM_CONFIDENCE_EXCESS_CM and not (is_edge and len(off) > 1)
        else Confidence.LOW
    )
    note = (
        f"Размер {best.size_label} — лучший вариант, но может сидеть {word} "
        f"в {zone_names[worst.zone]} (на {abs(worst.excess_cm):.1f} см за пределами сетки)."
    )
    if confidence == Confidence.LOW and is_edge:
        note += " Ваших мерок нет в сетке этого бренда, лучше выбрать другую вещь."
    return confidence, note
