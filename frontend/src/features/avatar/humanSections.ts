// Сечения подогнанного тела для одежды: те же BodyModel и уровни, что у процедурного манекена,
// но контур каждого сечения снят со сканированного тела, поэтому ткань ложится по фигуре.
import type { BodyZone } from '../../types/analysis'
import type { FittedHuman } from './humanFit'
import { PART, jointPosition, type HumanModel } from './humanModel'
import { DEFAULT_LOFT } from './loft'
import {
  boundsCenter,
  convexHull,
  perimeter,
  radialProfile,
  smoothAround,
  slicePoints,
  trianglesOf,
  type Point2,
  type TriangleSet,
} from './meshSlice'
import type { BodyModel, BodyPart, Landmarks, Section } from './sections'

/** Сколько сечений снимать с туловища, ноги и руки. */
const LEVELS = { torso: 30, leg: 18, arm: 16, head: 8 } as const
/** Наименьшее расстояние между уровнем зоны и соседним равным уровнем, см. */
const MIN_LEVEL_GAP_CM = 0.8
/** Сечения у самого края детали бывают из пары точек — такие пропускаются. */
const MIN_HULL_POINTS = 6

/** Сечение тела на высоте y: обхват по выпуклой оболочке, центр и контур по углам. */
export function sectionFromMesh(
  positions: Float32Array,
  set: TriangleSet,
  y: number,
  zone?: BodyZone,
  keep: (point: Point2, y: number) => boolean = () => true,
): Section | null {
  const hull = convexHull(slicePoints(positions, set, y).filter((point) => keep(point, y)))
  if (hull.length < MIN_HULL_POINTS) return null
  const center = boundsCenter(hull)
  const xs = hull.map((point) => point[0])
  const zs = hull.map((point) => point[1])
  const width = Math.max(...xs) - Math.min(...xs)
  const depth = Math.max(...zs) - Math.min(...zs)
  return {
    y,
    girth: perimeter(hull),
    depthRatio: width > 0 ? depth / width : 1,
    centerX: center[0],
    centerZ: center[1],
    zone,
    radii: smoothAround(radialProfile(hull, center, DEFAULT_LOFT.radialSegments), 2),
  }
}

/** Снимает сечения на равных уровнях от from до to (плюс уровни зон) снизу вверх. */
function sectionsBetween(
  positions: Float32Array,
  set: TriangleSet,
  from: number,
  to: number,
  count: number,
  zones: Array<[BodyZone, number]> = [],
  keep?: (point: Point2, y: number) => boolean,
): Section[] {
  const levels: Array<[number, BodyZone | undefined]> = []
  // Равный уровень рядом с уровнем зоны пропускается: два почти совпадающих сечения
  // дали бы на одежде резкую складку поперёк.
  const nearZone = (y: number) => zones.some(([, zoneY]) => Math.abs(zoneY - y) < MIN_LEVEL_GAP_CM)
  for (let step = 0; step <= count; step += 1) {
    const y = from + ((to - from) * step) / count
    if (step === 0 || step === count || !nearZone(y)) levels.push([y, undefined])
  }
  for (const [zone, y] of zones) levels.push([y, zone])
  levels.sort((first, second) => first[0] - second[0])
  return levels.flatMap(([y, zone]) => {
    const section = sectionFromMesh(positions, set, y, zone, keep)
    return section ? [section] : []
  })
}

/** Насколько срез выше подмышки может быть шире среза на уровне подмышки, см. */
const SHOULDER_MARGIN_CM = 1.5

/**
 * Выше подмышки срез туловища захватывает дельтовидные мышцы, и одежда получала бы
 * широкий «короб» с полкой на уровне груди. Там точки обрезаются по ширине туловища у
 * подмышки: плечо закрывает окат рукава.
 */
function shoulderClip(
  positions: Float32Array,
  set: TriangleSet,
  armpitY: number,
): (point: Point2, y: number) => boolean {
  const xs = slicePoints(positions, set, armpitY).map((point) => point[0])
  if (xs.length === 0) return () => true
  const low = Math.min(...xs) - SHOULDER_MARGIN_CM
  const high = Math.max(...xs) + SHOULDER_MARGIN_CM
  return (point, y) => y <= armpitY || (point[0] >= low && point[0] <= high)
}

/** Пределы вершин части тела по высоте. */
function partRange(model: HumanModel, positions: Float32Array, part: number): [number, number] {
  let low = Infinity
  let high = -Infinity
  for (let vertex = 0; vertex < model.vertexCount; vertex += 1) {
    if (model.parts[vertex] !== part) continue
    const y = positions[vertex * 3 + 1] as number
    low = Math.min(low, y)
    high = Math.max(high, y)
  }
  return [low, high]
}

/** Уровни тела по суставам и найденным уровням груди, талии и бёдер. */
export function humanLandmarks(model: HumanModel, fitted: FittedHuman): Landmarks {
  const p = fitted.positions
  const h = fitted.heightCm
  const y = (name: string) => jointPosition(model, p, name)[1]
  const average = (first: string, second: string) => (y(first) + y(second)) / 2
  const shoulderY = average('l-shoulder', 'r-shoulder')
  const neckY = y('neck')
  return {
    ankleY: average('l-ankle', 'r-ankle'),
    kneeY: average('l-knee', 'r-knee'),
    crotchY: partRange(model, p, PART.torso)[0],
    hipsY: fitted.zoneY.hips,
    waistY: fitted.zoneY.waist,
    chestY: fitted.zoneY.chest,
    armpitY: shoulderY - 0.05 * h,
    shoulderY,
    neckBaseY: neckY,
    neckTopY: neckY + 0.03 * h,
    elbowY: average('l-elbow', 'r-elbow'),
    wristY: average('l-hand', 'r-hand'),
  }
}

/** Закрытая часть тела из сечений (купола одежде не нужны: концы прячутся под тканью). */
function part(sections: Section[]): BodyPart {
  return { sections, capBottom: true, capTop: true, domeBottom: 0, domeTop: 0 }
}

/**
 * Модель тела для одежды по подогнанному скану. Стороны названы как у процедурного манекена:
 * «левая» часть лежит при x < 0 (у MakeHuman наоборот).
 */
export function humanBodyModel(model: HumanModel, fitted: FittedHuman): BodyModel {
  const p = fitted.positions
  const landmarks = humanLandmarks(model, fitted)
  const h = fitted.heightCm
  const triangles = (...parts: number[]) =>
    trianglesOf(p, model.indices, model.parts, new Set(parts))
  const torsoSet = triangles(PART.torso, PART.legPositiveX, PART.legNegativeX)
  const torso = sectionsBetween(
    p,
    torsoSet,
    landmarks.crotchY + 0.002 * h,
    landmarks.neckTopY,
    LEVELS.torso,
    [
      ['hips', landmarks.hipsY],
      ['waist', landmarks.waistY],
      ['chest', landmarks.chestY],
    ],
    shoulderClip(p, torsoSet, landmarks.armpitY),
  )
  // Верх ноги снимается вместе с туловищем, но только со своей стороны от середины тела:
  // так штанина у шага переходит в половину таза без ступеньки.
  const leg = (side: 1 | -1) =>
    part(
      sectionsBetween(
        p,
        torsoSet,
        0.2,
        landmarks.crotchY + 0.02 * h,
        LEVELS.leg,
        [],
        (point) => point[0] * side > 0,
      ),
    )
  const arm = (id: number) => {
    const [low, high] = partRange(model, p, id)
    return part(sectionsBetween(p, triangles(id), low + 0.2, high - 0.2, LEVELS.arm))
  }
  const [headLow, headHigh] = partRange(model, p, PART.head)
  return {
    heightCm: h,
    landmarks,
    parts: {
      head: part(
        sectionsBetween(p, triangles(PART.head), headLow + 0.2, headHigh - 0.2, LEVELS.head),
      ),
      torso: part(torso),
      leftLeg: leg(-1),
      rightLeg: leg(1),
      leftArm: arm(PART.armNegativeX),
      rightArm: arm(PART.armPositiveX),
    },
  }
}
