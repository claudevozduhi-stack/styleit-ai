"""Общие фикстуры: тестовый каталог в SQLite и клиент API."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.core.db import build_engine, get_session
from app.main import create_app
from scripts.import_catalog import parse_catalog, write_catalog

FIXTURE_DATA = Path(__file__).parent / "fixtures" / "data"


@pytest.fixture
def catalog_db(tmp_path: Path) -> Path:
    """Собирает каталог из тестовых CSV во временный файл SQLite."""
    parsed = parse_catalog(FIXTURE_DATA)
    assert parsed.errors == []
    db_path = tmp_path / "catalog.db"
    write_catalog(parsed, db_path)
    return db_path


@pytest.fixture
def db_session(catalog_db: Path) -> Iterator[Session]:
    """Сессия только на чтение к тестовому каталогу."""
    engine = build_engine(catalog_db, read_only=True)
    with sessionmaker(bind=engine)() as session:
        yield session
    engine.dispose()


@pytest.fixture
def client(catalog_db: Path) -> Iterator[TestClient]:
    """HTTP-клиент к приложению, подключённому к тестовому каталогу."""
    settings = Settings(catalog_db_path=catalog_db, rate_limit="1000/minute")
    app = create_app(settings)
    engine = build_engine(catalog_db, read_only=True)
    factory = sessionmaker(bind=engine)

    def override_session() -> Iterator[Session]:
        with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as test_client:
        yield test_client
    engine.dispose()
