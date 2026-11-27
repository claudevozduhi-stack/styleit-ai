// Подгонка анатомического тела под мерки: пол и вес, рост, затем обхваты груди, талии и бёдер.
// Обхваты меряются «сантиметром» — по выпуклой оболочке горизонтального сечения тела.
import type { Measurements } from '../../types/body'
import {
  PART,
  applyMorphs,
  closeLegs,
  jointPosition,
  lowerArms,
  type HumanModel,
} from './humanModel'
import { girthAt, slicePoints, trianglesOf, type TriangleSet } from './meshSlice'

/** Насколько опустить руки из A-позы MakeHuman, рад (~14°): кисти не задевают юбку. */
const ARM_LOWER_RAD = (14 * Math.PI) / 180
/** Насколько свести ноги из широкой стойки MakeHuman, рад (~4°). */
const LEG_CLOSE_RAD = (4 * Math.PI) / 180
/** Индекс массы, при котором тело MakeHuman «среднее», и разброс до крайних морфов веса. */
const AVERAGE_BMI = 21.5
const BMI_SPAN = 8
/** Пределы веса морфов обхвата: дальше морф искажает фигуру, остаток добирает масштаб. */
const MEASURE_LIMIT = 1
/** Сколько раз уточнять обхваты; каждая итерация меряет тело заново. */
const FIT_ITERATIONS = 4
/** Ширина зоны (доля роста), в которой масштабируется сечение, чтобы добрать остаток обхвата. */
const ZONE_SIGMA_SHARE = 0.035

type Zone = 'chest' | 'waist' | 'hips'

/**
 * Как найти уровень зоны: грудь — по самой выступающей вперёд точке (вершина груди),
 * талия — по наименьшему обхвату в окне (доли роста), бёдра — по тазобедренным суставам.
 * Наибольший обхват для бёдер не годится: ноги MakeHuman расставлены, и оболочка сечения
 * обеих ног растёт до самой промежности.
 */
type ZoneSearch =
  { from: number; to: number; pick: 'front' | 'min' } | { pick: 'joints'; joints: [string, string] }

const ZONE_SEARCH: Record<Zone, ZoneSearch> = {
  chest: { from: 0.66, to: 0.76, pick: 'front' },
  waist: { from: 0.58, to: 0.67, pick: 'min' },
  hips: { pick: 'joints', joints: ['l-upper-leg', 'r-upper-leg'] },
}

/** Морфы обхвата для каждой зоны (уменьшение и увеличение). */
const ZONE_TARGETS: Record<Zone, [string, string]> = {
  chest: ['bust-decr', 'bust-incr'],
  waist: ['waist-decr', 'waist-incr'],
  hips: ['hips-decr', 'hips-incr'],
}

const ZONE_MEASURE: Record<Zone, keyof Measurements> = {
  chest: 'chestCm',
  waist: 'waistCm',
  hips: 'hipsCm',
}

/** Подогнанное тело: вершины (тело + суставы) в сантиметрах от пола и уровни зон. */
export interface FittedHuman {
  positions: Float32Array
  heightCm: number
  zoneY: Record<Zone, number>
}

/** Треугольники, которыми меряется каждая зона: руки в обхват не попадают никогда. */
function zoneTriangles(model: HumanModel, positions: Float32Array): Record<Zone, TriangleSet> {
  const torso = trianglesOf(positions, model.indices, model.parts, new Set([PART.torso]))
  const hips = trianglesOf(
    positions,
    model.indices,
    model.parts,
    new Set([PART.torso, PART.legPositiveX, PART.legNegativeX]),
  )
  return { chest: torso, waist: torso, hips }
}

/** Вес морфов пола и комплекции по мерке веса (через индекс массы тела). */
export function baseWeights(m: Measurements): Record<string, number> {
  const bmi = m.weightKg / (m.heightCm / 100) ** 2
  const build = Math.min(Math.max((bmi - AVERAGE_BMI) / BMI_SPAN, -1), 1)
  return {
    [m.gender]: 1,
    [`${m.gender}-weight-max`]: Math.max(build, 0),
    [`${m.gender}-weight-min`]: Math.max(-build, 0),
    [`mannequin-${m.gender}`]: 1,
  }
}

/** Ставит тело на пол и масштабирует до роста. */
function placeAndScale(model: HumanModel, positions: Float32Array, heightCm: number): void {
  const ground = jointPosition(model, positions, 'ground')[1]
  let top = -Infinity
  for (let vertex = 0; vertex < model.vertexCount; vertex += 1) {
    top = Math.max(top, positions[vertex * 3 + 1] as number)
  }
  const scale = heightCm / (top - ground)
  for (let index = 0; index < positions.length; index += 3) {
    positions[index] = (positions[index] as number) * scale
    positions[index + 1] = ((positions[index + 1] as number) - ground) * scale
    positions[index + 2] = (positions[index + 2] as number) * scale
  }
}

/** Сколько уровней проверять в окне поиска зоны. */
const SEARCH_STEPS = 24

/** Самая выступающая вперёд (наибольшая z) точка сечения или -Infinity, если сечения нет. */
function frontAt(positions: Float32Array, set: TriangleSet, y: number): number {
  return slicePoints(positions, set, y).reduce(
    (front, point) => Math.max(front, point[1]),
    -Infinity,
  )
}

/** Уровень зоны по правилу из ZONE_SEARCH. */
function findZoneY(
  model: HumanModel,
  positions: Float32Array,
  set: TriangleSet,
  zone: Zone,
  heightCm: number,
): number {
  const search = ZONE_SEARCH[zone]
  if (search.pick === 'joints') {
    const [first, second] = search.joints
    return (
      (jointPosition(model, positions, first)[1] + jointPosition(model, positions, second)[1]) / 2
    )
  }
  // Для груди ищется наибольшая z, для талии — наименьший обхват (со знаком минус).
  const score = (y: number) =>
    search.pick === 'front' ? frontAt(positions, set, y) : -girthAt(positions, set, y) || -Infinity
  let bestY = search.from * heightCm
  let best = -Infinity
  for (let step = 0; step <= SEARCH_STEPS; step += 1) {
    const y = (search.from + ((search.to - search.from) * step) / SEARCH_STEPS) * heightCm
    const value = score(y)
    if (value > best) {
      best = value
      bestY = y
    }
  }
  return bestY
}

/** Вес морфов зоны в одном числе: отрицательный — уменьшение, положительный — увеличение. */
function measureWeights(values: Record<Zone, number>): Record<string, number> {
  const weights: Record<string, number> = {}
  for (const zone of Object.keys(values) as Zone[]) {
    const [decrease, increase] = ZONE_TARGETS[zone]
    weights[decrease] = Math.max(-values[zone], 0)
    weights[increase] = Math.max(values[zone], 0)
  }
  return weights
}

/** Строит тело с заданными весами обхватов: морфы, поза, рост. */
function shape(model: HumanModel, m: Measurements, measures: Record<Zone, number>): Float32Array {
  const positions = applyMorphs(model, { ...baseWeights(m), ...measureWeights(measures) })
  lowerArms(model, positions, ARM_LOWER_RAD)
  closeLegs(model, positions, LEG_CLOSE_RAD)
  placeAndScale(model, positions, m.heightCm)
  return positions
}

/** Мерит обхваты всех зон на их уровнях. */
function measure(
  model: HumanModel,
  positions: Float32Array,
  heightCm: number,
): { girth: Record<Zone, number>; y: Record<Zone, number> } {
  const sets = zoneTriangles(model, positions)
  const zones: Zone[] = ['chest', 'waist', 'hips']
  const y = Object.fromEntries(
    zones.map((zone) => [zone, findZoneY(model, positions, sets[zone], zone, heightCm)]),
  ) as Record<Zone, number>
  const girth = Object.fromEntries(
    zones.map((zone) => [zone, girthAt(positions, sets[zone], y[zone])]),
  ) as Record<Zone, number>
  return { girth, y }
}

/**
 * Добирает остаток обхвата масштабом сечений вокруг уровня зоны (плавно по высоте),
 * чтобы обхват на экране совпал с меркой, даже если морфам не хватило диапазона.
 */
function scaleZone(
  model: HumanModel,
  positions: Float32Array,
  zoneY: number,
  ratio: number,
  sigma: number,
  wanted: ReadonlySet<number>,
): void {
  for (let vertex = 0; vertex < model.vertexCount; vertex += 1) {
    if (!wanted.has(model.parts[vertex] as number)) continue
    const y = positions[vertex * 3 + 1] as number
    const factor = 1 + (ratio - 1) * Math.exp(-(((y - zoneY) / sigma) ** 2))
    positions[vertex * 3] = (positions[vertex * 3] as number) * factor
    positions[vertex * 3 + 2] = (positions[vertex * 3 + 2] as number) * factor
  }
}

/** Подгоняет тело под мерки: морфы обхватов по секущей, затем точная доводка масштабом. */
export function fitHuman(model: HumanModel, m: Measurements): FittedHuman {
  const measures: Record<Zone, number> = { chest: 0, waist: 0, hips: 0 }
  const zones: Zone[] = ['chest', 'waist', 'hips']
  // Чувствительность обхвата к морфу оценивается один раз по пробному шагу.
  const start = measure(model, shape(model, m, measures), m.heightCm)
  const probe = measure(model, shape(model, m, { chest: 0.5, waist: 0.5, hips: 0.5 }), m.heightCm)
  const slope = Object.fromEntries(
    zones.map((zone) => [zone, Math.max((probe.girth[zone] - start.girth[zone]) / 0.5, 1)]),
  ) as Record<Zone, number>
  let current = start
  for (let iteration = 0; iteration < FIT_ITERATIONS; iteration += 1) {
    for (const zone of zones) {
      const target = m[ZONE_MEASURE[zone]] as number
      const next = measures[zone] + (target - current.girth[zone]) / slope[zone]
      measures[zone] = Math.min(Math.max(next, -MEASURE_LIMIT), MEASURE_LIMIT)
    }
    current = measure(model, shape(model, m, measures), m.heightCm)
  }
  const positions = shape(model, m, measures)
  const sigma = ZONE_SIGMA_SHARE * m.heightCm
  for (let pass = 0; pass < 2; pass += 1) {
    const measured = measure(model, positions, m.heightCm)
    for (const zone of zones) {
      const target = m[ZONE_MEASURE[zone]] as number
      const wanted =
        zone === 'hips'
          ? new Set<number>([PART.torso, PART.legPositiveX, PART.legNegativeX])
          : new Set<number>([PART.torso])
      scaleZone(model, positions, measured.y[zone], target / measured.girth[zone], sigma, wanted)
    }
  }
  return { positions, heightCm: m.heightCm, zoneY: measure(model, positions, m.heightCm).y }
}
