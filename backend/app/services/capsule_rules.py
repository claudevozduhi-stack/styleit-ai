"""Проверка ответа ИИ кодом. Модель может ошибиться — мы не доверяем ей вслепую.

Каждая найденная проблема описывается по-русски: этот текст отправляется
модели при повторном запросе, чтобы она исправила ответ.
"""

from collections import Counter

from app.core.vocab import Slot
from app.schemas.stylist import AiCapsule, AiLook
from app.services.candidates import Candidate

MAX_LOOKS = 4


def _look_errors(index: int, look: AiLook, candidates: dict[int, Candidate]) -> list[str]:
    """Проверяет один образ: ID существуют, нет повторов, состав верх+низ или платье."""
    name = f"Образ {index} «{look.title}»"
    unknown = [item_id for item_id in look.item_ids if item_id not in candidates]
    if unknown:
        return [f"{name}: ID {unknown} нет в списке кандидатов."]
    if len(set(look.item_ids)) != len(look.item_ids):
        return [f"{name}: одна и та же вещь указана дважды."]

    slots = Counter(candidates[item_id].slot for item_id in look.item_ids)
    if slots[Slot.OUTER] > 1:
        return [f"{name}: больше одной вещи верхней одежды."]
    has_dress = slots[Slot.DRESS] == 1 and slots[Slot.TOP] == 0 and slots[Slot.BOTTOM] == 0
    has_pair = slots[Slot.DRESS] == 0 and slots[Slot.TOP] == 1 and slots[Slot.BOTTOM] == 1
    if not (has_dress or has_pair):
        return [f"{name}: нужен ровно один верх и один низ либо одно платье."]
    return []


def validate_capsule(
    capsule: AiCapsule, candidates: dict[int, Candidate], budget_kzt: int
) -> list[str]:
    """Возвращает список нарушений; пустой список — ответ корректен."""
    if not 1 <= len(capsule.looks) <= MAX_LOOKS:
        return [f"Нужно от 1 до {MAX_LOOKS} образов, получено {len(capsule.looks)}."]

    errors: list[str] = []
    for index, look in enumerate(capsule.looks, start=1):
        errors.extend(_look_errors(index, look, candidates))
    if errors:
        return errors

    unique_ids = {item_id for look in capsule.looks for item_id in look.item_ids}
    total = sum(candidates[item_id].product.price_kzt for item_id in unique_ids)
    if total > budget_kzt:
        errors.append(
            f"Сумма разных вещей {total} ₸ превышает бюджет {budget_kzt} ₸. "
            "Замени дорогие вещи или убери образ."
        )
    return errors
