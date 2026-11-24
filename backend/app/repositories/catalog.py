"""Запросы к каталогу. Вся работа с SQL для товаров собрана здесь."""

from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.vocab import Category, Gender, Season, Style
from app.models import Product
from app.schemas.catalog import ProductOut


@dataclass(frozen=True)
class CatalogFilter:
    """Условия отбора товаров. Пустое поле означает «не фильтровать»."""

    category: Category | None = None
    gender: Gender | None = None
    style: Style | None = None
    max_price: int | None = None


def _apply_filter(query: Select[Product], flt: CatalogFilter) -> Select[Product]:
    """Добавляет к запросу условия фильтра."""
    if flt.category is not None:
        query = query.where(Product.category == flt.category.value)
    if flt.gender is not None:
        # Унисекс-вещи подходят и мужчинам, и женщинам.
        query = query.where(
            or_(Product.gender == flt.gender.value, Product.gender == Gender.UNISEX.value)
        )
    if flt.style is not None:
        # Теги хранятся строкой "casual,office"; ищем точное совпадение элемента списка.
        query = query.where(func.instr("," + Product.style_tags + ",", f",{flt.style.value},") > 0)
    if flt.max_price is not None:
        query = query.where(Product.price_kzt <= flt.max_price)
    return query


def find_products(
    session: Session, flt: CatalogFilter, limit: int, offset: int
) -> tuple[int, list[Product]]:
    """Возвращает общее число подходящих товаров и одну страницу, дешёвые первыми."""
    base = _apply_filter(select(Product), flt)
    total = session.scalar(select(func.count()).select_from(base.subquery())) or 0
    page = session.scalars(
        base.options(joinedload(Product.store), joinedload(Product.brand))
        .order_by(Product.price_kzt, Product.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return total, list(page)


def get_products_by_ids(session: Session, ids: Sequence[int]) -> dict[int, Product]:
    """Загружает товары по списку ID; отсутствующие ID просто не попадут в словарь."""
    if not ids:
        return {}
    rows = session.scalars(
        select(Product)
        .options(joinedload(Product.store), joinedload(Product.brand))
        .where(Product.id.in_(ids))
    ).all()
    return {product.id: product for product in rows}


def to_product_out(product: Product) -> ProductOut:
    """Преобразует строку БД в схему ответа API."""
    return ProductOut(
        id=product.id,
        title=product.title,
        store=product.store.name,
        brand=product.brand.name,
        category=Category(product.category),
        gender=Gender(product.gender),
        price_kzt=product.price_kzt,
        color_name=product.color_name,
        color_hex=product.color_hex,
        style_tags=[Style(tag) for tag in product.style_tags.split(",")],
        season=Season(product.season),
        product_url=product.product_url,
        collected_at=product.collected_at,
    )
