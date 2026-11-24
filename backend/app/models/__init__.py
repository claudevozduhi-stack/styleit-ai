"""SQLAlchemy-модели. Импорт здесь регистрирует все таблицы в Base.metadata."""

from app.models.catalog import Brand, Product, SizeChart, Store

__all__ = ["Brand", "Product", "SizeChart", "Store"]
