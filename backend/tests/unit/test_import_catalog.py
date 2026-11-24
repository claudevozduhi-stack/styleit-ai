"""Проверки импорта каталога: валидация строк и связей между файлами."""

import shutil
from pathlib import Path

from scripts.import_catalog import main, parse_catalog
from tests.conftest import FIXTURE_DATA


def copy_fixture(tmp_path: Path) -> Path:
    """Копирует тестовые CSV во временную папку, чтобы их можно было портить."""
    target = tmp_path / "data"
    shutil.copytree(FIXTURE_DATA, target)
    return target


def test_fixture_catalog_is_valid() -> None:
    parsed = parse_catalog(FIXTURE_DATA)
    assert parsed.errors == []
    assert len(parsed.products) == 4
    assert parsed.products[0].color_hex == "#ffffff"


def test_bad_hex_and_unknown_category_are_reported_with_line(tmp_path: Path) -> None:
    data = copy_fixture(tmp_path)
    products = data / "catalog" / "products.csv"
    with products.open("a", encoding="utf-8") as file:
        file.write(
            "Тестовый магазин,Тест,Шляпа,hat,unisex,1000,красный,red,casual,all,"
            "https://example.com/p/9,2026-11-24\n"
        )
    errors = parse_catalog(data).errors
    assert any("products.csv:6: category" in error for error in errors)
    assert any("products.csv:6: color_hex" in error for error in errors)


def test_product_without_size_chart_is_rejected(tmp_path: Path) -> None:
    data = copy_fixture(tmp_path)
    with (data / "catalog" / "products.csv").open("a", encoding="utf-8") as file:
        file.write(
            "Тестовый магазин,Тест,Джинсы,jeans,male,9990,синий,#1f3a93,casual,all,"
            "https://example.com/p/10,2026-11-24\n"
        )
    errors = parse_catalog(data).errors
    assert any("нет размерной сетки" in error for error in errors)


def test_half_filled_range_is_rejected(tmp_path: Path) -> None:
    data = copy_fixture(tmp_path)
    with (data / "size_charts" / "size_charts.csv").open("a", encoding="utf-8") as file:
        file.write("Тестовый магазин,Тест,tshirt,unisex,XL,5,104,,,,,,,\n")
    errors = parse_catalog(data).errors
    assert any("обе границы" in error for error in errors)


def test_main_does_not_touch_db_on_errors(tmp_path: Path) -> None:
    data = copy_fixture(tmp_path)
    (data / "catalog" / "stores.csv").write_text("name,url,collected_at\n,bad,never\n")
    db_path = tmp_path / "catalog.db"
    assert main(["--data-dir", str(data), "--db", str(db_path)]) == 1
    assert not db_path.exists()


def test_main_builds_db(tmp_path: Path) -> None:
    db_path = tmp_path / "catalog.db"
    assert main(["--data-dir", str(FIXTURE_DATA), "--db", str(db_path)]) == 0
    assert db_path.exists()
