"""Сценарий подбора размера: товар из каталога → его сетка → расчёт."""

from sqlalchemy.orm import Session

from app.core.vocab import Category
from app.repositories.catalog import get_products_by_ids
from app.repositories.size_charts import get_size_rows
from app.schemas.body import MeasurementsIn
from app.schemas.size import SizeRecommendation
from app.services.size_engine import describe, evaluate_sizes, pick_best


class ProductNotFoundError(LookupError):
    """Товара с таким ID нет в каталоге."""


class SizeChartMissingError(LookupError):
    """У товара нет размерной сетки (импорт это запрещает, но защищаемся явно)."""


def recommend_size(
    session: Session, product_id: int, measurements: MeasurementsIn
) -> SizeRecommendation:
    """Подбирает размер товара по меркам пользователя."""
    product = get_products_by_ids(session, [product_id]).get(product_id)
    if product is None:
        raise ProductNotFoundError(product_id)
    rows = get_size_rows(session, product)
    if not rows:
        raise SizeChartMissingError(product_id)

    options = evaluate_sizes(Category(product.category), rows, measurements)
    best = pick_best(options)
    confidence, note = describe(best, options)
    return SizeRecommendation(
        product_id=product_id,
        recommended=best,
        confidence=confidence,
        note=note,
        options=options,
    )
