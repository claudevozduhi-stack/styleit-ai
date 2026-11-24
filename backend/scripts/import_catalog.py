"""Импорт каталога из CSV в SQLite.

Читает три файла:
  data/catalog/stores.csv            — магазины и дата сбора цен;
  data/size_charts/size_charts.csv   — размерные сетки брендов;
  data/catalog/products.csv          — товары.

Все строки сначала проверяются. Если есть хотя бы одна ошибка, база не
меняется, а скрипт печатает список ошибок с файлом и номером строки.
Новая база собирается во временный файл и только потом заменяет старую,
поэтому работающий API никогда не увидит полусобранный каталог.

Запуск из папки backend/:
    python -m scripts.import_catalog
    python -m scripts.import_catalog --data-dir ../data --db catalog.db
"""

import argparse
import csv
import os
import sys
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path

from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

import app.models  # noqa: F401  (регистрирует таблицы в Base.metadata)
from app.core.config import BACKEND_DIR
from app.core.db import Base, build_engine
from app.models import Brand, Product, SizeChart, Store
from app.schemas.catalog_import import ProductRow, SizeChartRow, StoreRow

DEFAULT_DATA_DIR = BACKEND_DIR.parent / "data"


@dataclass
class ParsedCatalog:
    """Проверенные строки всех трёх файлов и найденные ошибки."""

    stores: list[StoreRow] = field(default_factory=list)
    size_charts: list[SizeChartRow] = field(default_factory=list)
    products: list[ProductRow] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def read_rows[RowT: BaseModel](path: Path, schema: type[RowT], errors: list[str]) -> Iterator[RowT]:
    """Читает CSV и проверяет каждую строку схемой; ошибки складывает в errors.

    Номер строки считается как в табличном редакторе: заголовок — строка 1.
    """
    if not path.exists():
        errors.append(f"{path}: файл не найден")
        return
    with path.open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for line_number, raw in enumerate(reader, start=2):
            try:
                yield schema.model_validate(raw)
            except ValidationError as exc:
                for problem in exc.errors():
                    column = ".".join(str(part) for part in problem["loc"]) or "строка"
                    errors.append(f"{path.name}:{line_number}: {column}: {problem['msg']}")


def parse_catalog(data_dir: Path) -> ParsedCatalog:
    """Читает и проверяет все CSV, включая связи между файлами."""
    parsed = ParsedCatalog()
    parsed.stores = list(read_rows(data_dir / "catalog" / "stores.csv", StoreRow, parsed.errors))
    parsed.size_charts = list(
        read_rows(data_dir / "size_charts" / "size_charts.csv", SizeChartRow, parsed.errors)
    )
    parsed.products = list(
        read_rows(data_dir / "catalog" / "products.csv", ProductRow, parsed.errors)
    )
    check_references(parsed)
    return parsed


def check_references(parsed: ParsedCatalog) -> None:
    """Проверяет связи: магазины существуют, у каждого товара есть размерная сетка."""
    store_names = {store.name for store in parsed.stores}
    if len(store_names) != len(parsed.stores):
        parsed.errors.append("stores.csv: названия магазинов повторяются")

    chart_keys: set[tuple[str, str, str, str]] = set()
    seen_sizes: set[tuple[str, str, str, str, str]] = set()
    for row in parsed.size_charts:
        if row.store not in store_names:
            parsed.errors.append(f"size_charts.csv: неизвестный магазин «{row.store}»")
        size_key = (row.store, row.brand, row.category, row.gender, row.size_label)
        if size_key in seen_sizes:
            parsed.errors.append(f"size_charts.csv: размер повторяется: {' / '.join(size_key)}")
        seen_sizes.add(size_key)
        chart_keys.add((row.store, row.brand, row.category, row.gender))

    for product in parsed.products:
        if product.store not in store_names:
            parsed.errors.append(
                f"products.csv: «{product.title}»: неизвестный магазин «{product.store}»"
            )
        if (product.store, product.brand, product.category, product.gender) not in chart_keys:
            parsed.errors.append(
                f"products.csv: «{product.title}»: нет размерной сетки для "
                f"{product.store} / {product.brand} / {product.category} / {product.gender}"
            )


def write_catalog(parsed: ParsedCatalog, db_path: Path) -> None:
    """Собирает новую базу во временном файле и атомарно заменяет ею старую."""
    tmp_path = db_path.with_suffix(".tmp.db")
    tmp_path.unlink(missing_ok=True)
    engine = build_engine(tmp_path, read_only=False)
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        stores = {
            row.name: Store(name=row.name, url=str(row.url), collected_at=row.collected_at)
            for row in parsed.stores
        }
        session.add_all(stores.values())

        brands: dict[tuple[str, str], Brand] = {}

        def brand_for(store_name: str, brand_name: str) -> Brand:
            """Возвращает бренд магазина, создавая его при первом упоминании."""
            key = (store_name, brand_name)
            if key not in brands:
                brands[key] = Brand(name=brand_name, store=stores[store_name])
                session.add(brands[key])
            return brands[key]

        for chart in parsed.size_charts:
            session.add(
                SizeChart(
                    brand=brand_for(chart.store, chart.brand),
                    category=chart.category.value,
                    gender=chart.gender.value,
                    size_label=chart.size_label,
                    size_order=chart.size_order,
                    chest_min=chart.chest_min,
                    chest_max=chart.chest_max,
                    waist_min=chart.waist_min,
                    waist_max=chart.waist_max,
                    hips_min=chart.hips_min,
                    hips_max=chart.hips_max,
                    height_min=chart.height_min,
                    height_max=chart.height_max,
                )
            )

        for product in parsed.products:
            session.add(
                Product(
                    store=stores[product.store],
                    brand=brand_for(product.store, product.brand),
                    title=product.title,
                    category=product.category.value,
                    gender=product.gender.value,
                    price_kzt=product.price_kzt,
                    color_name=product.color_name,
                    color_hex=product.color_hex,
                    style_tags=",".join(tag.value for tag in product.style_tags),
                    season=product.season.value,
                    product_url=str(product.product_url),
                    collected_at=product.collected_at,
                )
            )
        session.commit()

    engine.dispose()
    os.replace(tmp_path, db_path)


def main(argv: list[str] | None = None) -> int:
    """Точка входа командной строки. Возвращает код выхода процесса."""
    parser = argparse.ArgumentParser(description="Импорт каталога StyleIt AI из CSV в SQLite")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--db", type=Path, default=BACKEND_DIR / "catalog.db")
    args = parser.parse_args(argv)

    parsed = parse_catalog(args.data_dir)
    if parsed.errors:
        print(f"Найдено ошибок: {len(parsed.errors)}. База не изменена.", file=sys.stderr)
        for error in parsed.errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    if not parsed.products:
        print("В products.csv нет ни одного товара. База не изменена.", file=sys.stderr)
        return 1

    write_catalog(parsed, args.db)
    print(
        f"Готово: магазинов {len(parsed.stores)}, строк размерных сеток "
        f"{len(parsed.size_charts)}, товаров {len(parsed.products)} → {args.db}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
