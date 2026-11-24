"""Работа с цветами: расстояние между цветами для подбора под палитру."""

import math


def hex_to_rgb(color: str) -> tuple[int, int, int]:
    """Переводит #RRGGBB в кортеж (R, G, B)."""
    value = color.lstrip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def color_distance(first: str, second: str) -> float:
    """Расстояние между цветами по формуле «redmean» — грубое, но близкое к восприятию глазом.

    Возвращает значение от 0 (одинаковые цвета) примерно до 765.
    """
    r1, g1, b1 = hex_to_rgb(first)
    r2, g2, b2 = hex_to_rgb(second)
    mean_red = (r1 + r2) / 2
    dr, dg, db = r1 - r2, g1 - g2, b1 - b2
    return math.sqrt(
        (2 + mean_red / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean_red) / 256) * db * db
    )


def palette_distance(color: str, palette: list[str]) -> float:
    """Расстояние до ближайшего цвета палитры; без палитры все цвета равноценны."""
    if not palette:
        return 0.0
    return min(color_distance(color, item) for item in palette)
