"""Таблицы каталога: магазины, бренды, размерные сетки и товары.

Здесь хранятся только факты о товарах (название, цена, цвет, размеры,
ссылка). Фото и тексты описаний магазинов не храним: они защищены
авторским правом.
"""

from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Store(Base):
    """Магазин РК, из которого собраны товары."""

    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    url: Mapped[str] = mapped_column(String(500))
    # Дата, на которую собраны цены этого магазина.
    collected_at: Mapped[date] = mapped_column(Date)

    brands: Mapped[list["Brand"]] = relationship(back_populates="store")


class Brand(Base):
    """Бренд внутри магазина. У каждого бренда своя размерная сетка."""

    __tablename__ = "brands"
    __table_args__ = (UniqueConstraint("name", "store_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"))

    store: Mapped[Store] = relationship(back_populates="brands")


class SizeChart(Base):
    """Одна строка размерной сетки: размер бренда и диапазоны обхватов тела в см.

    Диапазоны описывают тело, на которое рассчитан размер (как в таблицах
    магазинов). Если зона для категории не важна (например, грудь для брюк),
    её границы равны NULL.
    """

    __tablename__ = "size_charts"
    __table_args__ = (UniqueConstraint("brand_id", "category", "gender", "size_label"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"))
    category: Mapped[str] = mapped_column(String(40))
    gender: Mapped[str] = mapped_column(String(10))
    size_label: Mapped[str] = mapped_column(String(20))
    # Порядок размера внутри сетки (XS=1, S=2, ...), нужен для поиска соседних размеров.
    size_order: Mapped[int] = mapped_column(Integer)
    chest_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    chest_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    waist_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    waist_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    hips_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    hips_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    height_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    height_max: Mapped[float | None] = mapped_column(Float, nullable=True)

    brand: Mapped[Brand] = relationship()


class Product(Base):
    """Товар из магазина: только факты и ссылка на страницу магазина."""

    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"))
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"))
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(40), index=True)
    gender: Mapped[str] = mapped_column(String(10), index=True)
    price_kzt: Mapped[int] = mapped_column(Integer, index=True)
    color_name: Mapped[str] = mapped_column(String(60))
    color_hex: Mapped[str] = mapped_column(String(7))
    # Стиль-теги через запятую: casual,office,sport,evening,street.
    style_tags: Mapped[str] = mapped_column(String(200))
    season: Mapped[str] = mapped_column(String(20))
    product_url: Mapped[str] = mapped_column(String(500))
    collected_at: Mapped[date] = mapped_column(Date)

    store: Mapped[Store] = relationship()
    brand: Mapped[Brand] = relationship()
