"""Тексты промптов. Хранятся в .md-файлах рядом и читаются при запуске."""

from functools import cache
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent


@cache
def load_prompt(name: str) -> str:
    """Читает промпт по имени файла без расширения."""
    return (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")
