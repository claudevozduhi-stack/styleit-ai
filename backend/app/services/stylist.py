"""ИИ-стилист: кандидаты из каталога → языковая модель → проверка кодом → капсула со сметой.

Модель видит только обезличенные факты: пол фигуры, тип фигуры, стиль,
повод, бюджет, палитру и список товаров с подобранными размерами. Мерки,
ID клиента и любые тексты пользователя в модель не отправляются.
"""

import json
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.ai.client import LLMClient, Message, Usage
from app.ai.errors import AIInvalidResponseError
from app.ai.prompts import load_prompt
from app.repositories.catalog import to_product_out
from app.schemas.body import BodyAnalysisOut
from app.schemas.stylist import AiCapsule, CapsuleOut, CapsuleRequest, LookItemOut, LookOut
from app.services.body_analysis import analyze_body
from app.services.candidates import Candidate, select_candidates
from app.services.capsule_rules import validate_capsule
from app.services.estimate import build_estimate, unique_prices

MAX_RETRIES = 2  # повторных запросов после первого, если ответ не прошёл проверку
DISCLAIMER = (
    "Рекомендации ИИ носят справочный характер. Цены указаны на дату сбора каталога, "
    "перед покупкой сверьтесь с таблицей размеров и ценой в магазине."
)


@dataclass(frozen=True)
class StylistResult:
    """Капсула и сведения о запросе к ИИ для обезличенной статистики."""

    capsule: CapsuleOut
    usage: Usage
    attempts: int


def build_prompt(
    request: CapsuleRequest, body: BodyAnalysisOut, candidates: list[Candidate]
) -> str:
    """Собирает JSON с фактами для модели. Только обезличенные данные."""
    payload = {
        "figure": request.measurements.gender,
        "body_type": body.body_type.value,
        "style": request.style.value,
        "occasion": request.occasion.value,
        "budget_kzt": request.budget_kzt,
        "palette_hex": request.palette_hex,
        "candidates": [
            {
                "id": c.product.id,
                "slot": c.slot.value,
                "category": c.product.category,
                "title": c.product.title,
                "brand": c.product.brand.name,
                "color": c.product.color_name,
                "color_hex": c.product.color_hex,
                "price_kzt": c.product.price_kzt,
                "size": c.size.size_label,
                "size_confidence": c.size_confidence.value,
            }
            for c in candidates
        ],
    }
    return json.dumps(payload, ensure_ascii=False)


async def ask_model(
    llm: LLMClient, prompt: str, by_id: dict[int, Candidate], budget_kzt: int
) -> tuple[AiCapsule, Usage, int]:
    """Запрашивает капсулу; при ошибках проверки просит модель исправиться."""
    system = load_prompt("stylist_system")
    messages = [Message(role="user", text=prompt)]
    total = Usage(input_tokens=0, output_tokens=0)
    for attempt in range(1, MAX_RETRIES + 2):
        capsule, raw, usage = await llm.generate_json(system, messages, AiCapsule)
        total = Usage(
            total.input_tokens + usage.input_tokens, total.output_tokens + usage.output_tokens
        )
        errors = validate_capsule(capsule, by_id, budget_kzt)
        if not errors:
            return capsule, total, attempt
        feedback = (
            "Ответ не прошёл проверку:\n- "
            + "\n- ".join(errors)
            + "\nИсправь и пришли JSON заново."
        )
        messages += [Message(role="model", text=raw), Message(role="user", text=feedback)]
    raise AIInvalidResponseError("ИИ не смог собрать корректную капсулу. Попробуйте ещё раз.")


def assemble(
    capsule: AiCapsule, by_id: dict[int, Candidate], request: CapsuleRequest, body: BodyAnalysisOut
) -> CapsuleOut:
    """Превращает проверенный ответ модели в ответ API с размерами и сметой."""
    prices = {item_id: c.product.price_kzt for item_id, c in by_id.items()}
    looks = [
        LookOut(
            title=look.title,
            explanation=look.explanation,
            items=[
                LookItemOut(
                    product=to_product_out(by_id[item_id].product),
                    recommended_size=by_id[item_id].size.size_label,
                    size_confidence=by_id[item_id].size_confidence,
                    size_note=by_id[item_id].size_note,
                )
                for item_id in look.item_ids
            ],
            total_kzt=sum(prices[item_id] for item_id in look.item_ids),
        )
        for look in capsule.looks
    ]
    estimate = build_estimate(
        unique_prices((look.item_ids for look in capsule.looks), prices), request.budget_kzt
    )
    return CapsuleOut(
        body_type=body.body_type,
        body_type_title=body.title,
        looks=looks,
        summary=capsule.summary,
        fit_advice=capsule.fit_advice,
        estimate=estimate,
        disclaimer=DISCLAIMER,
    )


async def build_capsule(session: Session, request: CapsuleRequest, llm: LLMClient) -> StylistResult:
    """Полный сценарий подбора капсулы."""
    body = analyze_body(request.measurements)
    candidates = select_candidates(session, request)
    by_id = {c.product.id: c for c in candidates}
    prompt = build_prompt(request, body, candidates)
    capsule, usage, attempts = await ask_model(llm, prompt, by_id, request.budget_kzt)
    return StylistResult(
        capsule=assemble(capsule, by_id, request, body), usage=usage, attempts=attempts
    )
