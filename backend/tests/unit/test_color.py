"""Проверки расстояния между цветами."""

from app.services.color import color_distance, palette_distance


def test_same_color_is_zero() -> None:
    assert color_distance("#123456", "#123456") == 0


def test_close_colors_are_closer_than_opposite() -> None:
    assert color_distance("#f3eee3", "#ffffff") < color_distance("#111111", "#ffffff")


def test_palette_takes_nearest() -> None:
    assert palette_distance("#fefefe", ["#000000", "#ffffff"]) < 10
    assert palette_distance("#fefefe", []) == 0
