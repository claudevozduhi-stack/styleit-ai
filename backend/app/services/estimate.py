"""Смета капсулы."""

from collections.abc import Iterable

from app.schemas.stylist import EstimateOut


def build_estimate(item_prices: dict[int, int], budget_kzt: int) -> EstimateOut:
    """Считает смету по уникальным вещам: ID товара → цена в тенге."""
    total = sum(item_prices.values())
    return EstimateOut(
        items_count=len(item_prices),
        total_kzt=total,
        budget_kzt=budget_kzt,
        remaining_kzt=budget_kzt - total,
        within_budget=total <= budget_kzt,
    )


def unique_prices(looks: Iterable[Iterable[int]], prices: dict[int, int]) -> dict[int, int]:
    """Собирает цены всех разных вещей из образов (повторяющаяся вещь — один раз)."""
    return {item_id: prices[item_id] for look in looks for item_id in look}
