"""Отбор товаров-кандидатов для стилиста.

ИИ получает не весь каталог, а короткий список вещей, которые уже точно
подходят: нужный пол и стиль, цена в бюджете, есть подходящий размер.
Так модель не может предложить вещь, которая не сядет или не по карману,
а запрос остаётся маленьким (важно для бесплатного лимита).
"""

from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.vocab import CATEGORY_SLOT, Category, Confidence, Gender, Slot
from app.models import Product
from app.repositories.catalog import CatalogFilter, find_products
from app.repositories.size_charts import get_size_rows
from app.schemas.size import SizeOption
from app.schemas.stylist import CapsuleRequest
from app.services.color import palette_distance
from app.services.size_engine import SizeRow, describe, evaluate_sizes, pick_best

MAX_PER_SLOT = 8  # не больше стольких вещей каждого типа в промпте
MAX_CATALOG_SCAN = 1000  # верхняя граница просмотра каталога за один запрос


@dataclass(frozen=True)
class Candidate:
    """Товар, прошедший отбор, вместе с подобранным размером."""

    product: Product
    slot: Slot
    size: SizeOption
    size_confidence: Confidence
    size_note: str
    palette_distance: float


class NotEnoughCandidatesError(LookupError):
    """В каталоге нет вещей, из которых можно собрать хотя бы один образ."""


def _size_rows_cached(
    session: Session, product: Product, cache: dict[tuple[int, str, str], list[SizeRow]]
) -> list[SizeRow]:
    """Сетка одного бренда, категории и пола загружается из БД один раз за запрос."""
    key = (product.brand_id, product.category, product.gender)
    if key not in cache:
        cache[key] = get_size_rows(session, product)
    return cache[key]


def _to_candidate(
    session: Session,
    product: Product,
    request: CapsuleRequest,
    cache: dict[tuple[int, str, str], list[SizeRow]],
) -> Candidate | None:
    """Подбирает размер; вещь без подходящего размера отбрасывается."""
    rows = _size_rows_cached(session, product, cache)
    if not rows:
        return None
    category = Category(product.category)
    options = evaluate_sizes(category, rows, request.measurements)
    best = pick_best(options)
    confidence, note = describe(best, options)
    if confidence == Confidence.LOW:
        return None
    return Candidate(
        product=product,
        slot=CATEGORY_SLOT[category],
        size=best,
        size_confidence=confidence,
        size_note=note,
        palette_distance=palette_distance(product.color_hex, request.palette_hex),
    )


def can_build_look(slots: set[Slot]) -> bool:
    """Можно ли собрать хотя бы один образ: верх + низ или платье."""
    return Slot.DRESS in slots or {Slot.TOP, Slot.BOTTOM} <= slots


def select_candidates(session: Session, request: CapsuleRequest) -> list[Candidate]:
    """Отбирает кандидатов и оставляет лучших по каждому типу вещи."""
    flt = CatalogFilter(
        gender=Gender(request.measurements.gender),
        style=request.style,
        max_price=request.budget_kzt,
    )
    _, products = find_products(session, flt, limit=MAX_CATALOG_SCAN, offset=0)

    cache: dict[tuple[int, str, str], list[SizeRow]] = {}
    by_slot: dict[Slot, list[Candidate]] = defaultdict(list)
    for product in products:
        candidate = _to_candidate(session, product, request, cache)
        if candidate is not None:
            by_slot[candidate.slot].append(candidate)

    if not can_build_look(set(by_slot)):
        raise NotEnoughCandidatesError(
            "В каталоге пока нет вещей, из которых можно собрать образ под ваши мерки, "
            "стиль и бюджет. Попробуйте другой стиль или увеличьте бюджет."
        )

    selected: list[Candidate] = []
    for items in by_slot.values():
        # Сначала уверенный размер, затем близость к палитре, затем цена.
        items.sort(
            key=lambda c: (
                c.size_confidence != Confidence.HIGH,
                c.palette_distance,
                c.product.price_kzt,
            )
        )
        selected.extend(items[:MAX_PER_SLOT])
    return selected
