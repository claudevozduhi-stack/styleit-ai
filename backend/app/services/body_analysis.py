"""Определение типа фигуры по меркам.

Правила основаны на методике FFIT (Female Figure Identification Technique,
Simmons et al., 2004), которая сравнивает разницы обхватов груди, талии и
бёдер. Пороги переведены из дюймов в сантиметры и округлены. Для мужской
фигуры «песочные часы» не выделяются: такая фигура относится к прямоугольнику
или перевёрнутому треугольнику.

Это детерминированный расчёт без ИИ: тип фигуры затем передаётся стилисту
(Claude) как факт, на который он опирается при подборе фасонов.
"""

from dataclasses import dataclass

from app.core.vocab import BodyType
from app.schemas.body import BodyAnalysisOut, MeasurementsIn

# Пороги FFIT в сантиметрах (1 дюйм = 2,54 см).
BALANCED_CHEST_HIPS_CM = 9.0  # грудь и бёдра считаются уравновешенными, если разница меньше
HOURGLASS_CHEST_HIPS_CM = 2.5  # для песочных часов грудь не больше бёдер на ~1 дюйм
HOURGLASS_CHEST_WAIST_CM = 23.0  # выраженная талия относительно груди (~9 дюймов)
HOURGLASS_HIPS_WAIST_CM = 25.0  # выраженная талия относительно бёдер (~10 дюймов)
# Овал: талия почти равна самому узкому из обхватов груди и бёдер или больше его.
OVAL_WAIST_SHARE = 0.95

TITLES: dict[BodyType, str] = {
    BodyType.HOURGLASS: "Песочные часы",
    BodyType.TRIANGLE: "Треугольник (груша)",
    BodyType.INVERTED_TRIANGLE: "Перевёрнутый треугольник",
    BodyType.RECTANGLE: "Прямоугольник",
    BodyType.OVAL: "Овал",
}


@dataclass(frozen=True)
class Differences:
    """Разницы обхватов, на которых строится классификация."""

    chest_hips: float
    chest_waist: float
    hips_waist: float


def compute_differences(m: MeasurementsIn) -> Differences:
    """Считает разницы обхватов груди, талии и бёдер в сантиметрах."""
    return Differences(
        chest_hips=m.chest_cm - m.hips_cm,
        chest_waist=m.chest_cm - m.waist_cm,
        hips_waist=m.hips_cm - m.waist_cm,
    )


def classify(m: MeasurementsIn, d: Differences) -> tuple[BodyType, str]:
    """Возвращает тип фигуры и объяснение. Правила проверяются в порядке приоритета."""
    if m.waist_cm >= OVAL_WAIST_SHARE * min(m.chest_cm, m.hips_cm):
        return BodyType.OVAL, "Талия почти равна обхвату груди или бёдер, акцент на центре фигуры."

    is_hourglass = (
        m.gender == "female"
        and d.chest_hips <= HOURGLASS_CHEST_HIPS_CM
        and -d.chest_hips < BALANCED_CHEST_HIPS_CM
        and (d.chest_waist >= HOURGLASS_CHEST_WAIST_CM or d.hips_waist >= HOURGLASS_HIPS_WAIST_CM)
    )
    if is_hourglass:
        return BodyType.HOURGLASS, "Грудь и бёдра почти равны, талия заметно уже."

    if -d.chest_hips >= BALANCED_CHEST_HIPS_CM:
        return BodyType.TRIANGLE, "Бёдра заметно шире груди."

    if d.chest_hips >= BALANCED_CHEST_HIPS_CM:
        return BodyType.INVERTED_TRIANGLE, "Грудь и плечи заметно шире бёдер."

    return BodyType.RECTANGLE, "Грудь, талия и бёдра близки по объёму, талия выражена слабо."


def analyze_body(m: MeasurementsIn) -> BodyAnalysisOut:
    """Определяет тип фигуры и возвращает его вместе с показателями."""
    d = compute_differences(m)
    body_type, explanation = classify(m, d)
    height_m = m.height_cm / 100
    return BodyAnalysisOut(
        body_type=body_type,
        title=TITLES[body_type],
        explanation=explanation,
        bmi=round(m.weight_kg / (height_m * height_m), 1),
        waist_to_hip=round(m.waist_cm / m.hips_cm, 2),
        chest_minus_hips_cm=round(d.chest_hips, 1),
        chest_minus_waist_cm=round(d.chest_waist, 1),
        hips_minus_waist_cm=round(d.hips_waist, 1),
    )
