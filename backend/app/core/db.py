"""Подключение к SQLite с каталогом.

Во время работы API база используется только на чтение: каталог
пересобирается скриптом импорта, а персональные данные сюда не пишутся.
"""

from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    """Базовый класс для всех SQLAlchemy-моделей."""


def build_engine(db_path: Path, read_only: bool) -> Engine:
    """Создаёт движок SQLAlchemy для файла SQLite.

    В режиме read_only файл открывается через URI с mode=ro, поэтому
    любая попытка записи из API завершится ошибкой на уровне SQLite.
    """
    if read_only:
        url = f"sqlite:///file:{db_path.as_posix()}?mode=ro&uri=true"
    else:
        url = f"sqlite:///{db_path.as_posix()}"
    # check_same_thread=False: FastAPI обслуживает синхронные эндпоинты в пуле потоков.
    return create_engine(url, connect_args={"check_same_thread": False})


@lru_cache
def get_engine() -> Engine:
    """Движок каталога для API (только чтение), создаётся один раз."""
    from app.core.config import get_settings

    db_path = get_settings().catalog_db_path
    if not db_path.exists():
        raise RuntimeError(
            f"Каталог не найден: {db_path}. Соберите его командой "
            "`python -m scripts.import_catalog`."
        )
    return build_engine(db_path, read_only=True)


def get_session() -> Iterator[Session]:
    """Зависимость FastAPI: выдаёт сессию БД на время одного запроса."""
    session_factory = sessionmaker(bind=get_engine(), expire_on_commit=False)
    with session_factory() as session:
        yield session
