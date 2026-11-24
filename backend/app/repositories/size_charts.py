"""Запросы к размерным сеткам."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.vocab import BodyZone
from app.models import Product, SizeChart
from app.services.size_engine import SizeRow


def _ranges(chart: SizeChart) -> dict[BodyZone, tuple[float, float]]:
    """Собирает заполненные диапазоны строки сетки по зонам."""
    pairs = {
        BodyZone.CHEST: (chart.chest_min, chart.chest_max),
        BodyZone.WAIST: (chart.waist_min, chart.waist_max),
        BodyZone.HIPS: (chart.hips_min, chart.hips_max),
        BodyZone.HEIGHT: (chart.height_min, chart.height_max),
    }
    return {
        zone: (low, high)
        for zone, (low, high) in pairs.items()
        if low is not None and high is not None
    }


def get_size_rows(session: Session, product: Product) -> list[SizeRow]:
    """Возвращает размерную сетку бренда для категории и пола товара."""
    charts = session.scalars(
        select(SizeChart)
        .where(
            SizeChart.brand_id == product.brand_id,
            SizeChart.category == product.category,
            SizeChart.gender == product.gender,
        )
        .order_by(SizeChart.size_order)
    ).all()
    return [
        SizeRow(size_label=chart.size_label, size_order=chart.size_order, ranges=_ranges(chart))
        for chart in charts
    ]
