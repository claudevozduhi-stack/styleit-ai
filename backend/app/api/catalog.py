"""Эндпоинты каталога товаров."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.core.vocab import Category, Gender, Style
from app.repositories.catalog import CatalogFilter, find_products, to_product_out
from app.schemas.catalog import CatalogPage

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("", response_model=CatalogPage, summary="Товары каталога с фильтрами")
def list_catalog(
    session: Annotated[Session, Depends(get_session)],
    category: Category | None = None,
    gender: Gender | None = None,
    style: Style | None = None,
    max_price: Annotated[int | None, Query(gt=0)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CatalogPage:
    """Возвращает страницу каталога, отсортированную по цене."""
    flt = CatalogFilter(category=category, gender=gender, style=style, max_price=max_price)
    total, products = find_products(session, flt, limit=limit, offset=offset)
    return CatalogPage(total=total, items=[to_product_out(product) for product in products])
