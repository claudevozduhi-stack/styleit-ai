// Форма сечения: эллипс с анатомическими «выпуклостями» и складками ткани.
// После всех деформаций контур масштабируется так, чтобы его длина снова равнялась обхвату:
// грудь, талия и бёдра на экране всегда совпадают с мерками и размерной сеткой.
import { ramanujanPerimeter } from './ellipse'

/** Сила анатомических выпуклостей сечения (доля радиуса, 0 — нет выпуклости). */
export interface Features {
  bust: number
  buttocks: number
  shoulderBlades: number
  belly: number
}

export const NO_FEATURES: Features = { bust: 0, buttocks: 0, shoulderBlades: 0, belly: 0 }

/** Одна «доля» выпуклости: направление (рад; 0 — вправо по X, π/2 — вперёд по Z) и ширина. */
interface Lobe {
  angle: number
  width: number
}

const FRONT = Math.PI / 2
const BACK = -Math.PI / 2

/** Где на контуре расположена каждая выпуклость: парные доли для груди, ягодиц и лопаток. */
const FEATURE_LOBES: Record<keyof Features, Lobe[]> = {
  bust: [
    { angle: FRONT - 0.42, width: 0.3 },
    { angle: FRONT + 0.42, width: 0.3 },
  ],
  buttocks: [
    { angle: BACK - 0.45, width: 0.38 },
    { angle: BACK + 0.45, width: 0.38 },
  ],
  shoulderBlades: [
    { angle: BACK - 0.6, width: 0.32 },
    { angle: BACK + 0.6, width: 0.32 },
  ],
  belly: [{ angle: FRONT, width: 0.6 }],
}

/** Параметры контура одного кольца. Длины в сантиметрах. */
export interface OutlineInput {
  a: number
  b: number
  centerX: number
  centerZ: number
  features: Features
  /** Глубина складок ткани (0 — гладко). */
  foldDepth: number
  /** Число складок по окружности. */
  foldCount: number
  /** Сдвиг фазы складок, чтобы они «гуляли» по высоте, а не шли идеальными рёбрами. */
  foldPhase: number
  /**
   * Готовый контур: расстояние от центра по равным углам (с +X к +Z). Есть у сечений,
   * снятых со скана тела; тогда эллипс и выпуклости не используются.
   */
  radii?: readonly number[]
}

/** Кратчайшая разница углов в диапазоне [−π, π]. */
function angleDelta(first: number, second: number): number {
  const delta = (first - second) % (2 * Math.PI)
  if (delta > Math.PI) return delta - 2 * Math.PI
  if (delta < -Math.PI) return delta + 2 * Math.PI
  return delta
}

/** Множитель радиуса в направлении angle от всех выпуклостей (гауссовы «холмы»). */
export function featureScale(features: Features, angle: number): number {
  let scale = 1
  for (const key of Object.keys(FEATURE_LOBES) as Array<keyof Features>) {
    const amount = features[key]
    if (amount === 0) continue
    for (const lobe of FEATURE_LOBES[key]) {
      const delta = angleDelta(angle, lobe.angle)
      scale += amount * Math.exp(-(delta * delta) / (2 * lobe.width * lobe.width))
    }
  }
  return scale
}

/** Длина замкнутого контура из точек (x, z). */
export function outlineLength(points: Array<[number, number]>): number {
  let length = 0
  points.forEach(([x, z], index) => {
    const [nextX, nextZ] = points[(index + 1) % points.length] as [number, number]
    length += Math.hypot(nextX - x, nextZ - z)
  })
  return length
}

/**
 * Точки контура (x, z) по окружности, `segments` штук, начиная с направления +X.
 * Сначала эллипс с выпуклостями масштабируется так, чтобы длина контура равнялась обхвату.
 * Затем складки откладываются только наружу: ткань собирается в складки поверх тела
 * и никогда не уходит внутрь него.
 */
export function ringOutline(input: OutlineInput, segments: number): Array<[number, number]> {
  if (input.radii && input.radii.length === segments) return radialOutline(input, input.radii)
  const shaped: Array<[number, number]> = []
  for (let k = 0; k < segments; k += 1) {
    const angle = (2 * Math.PI * k) / segments
    const radiusScale = featureScale(input.features, angle)
    shaped.push([input.a * Math.cos(angle) * radiusScale, input.b * Math.sin(angle) * radiusScale])
  }
  const scale = ramanujanPerimeter(input.a, input.b) / outlineLength(shaped)
  return shaped.map(([x, z], k) => {
    const angle = (2 * Math.PI * k) / segments
    const fold = input.foldDepth * 0.5 * (1 + Math.cos(input.foldCount * angle + input.foldPhase))
    const radius = Math.hypot(x, z) * scale || 1
    const grow = (radius + fold) / radius
    return [input.centerX + x * scale * grow, input.centerZ + z * scale * grow]
  })
}

/** Складка ткани в направлении angle: откладывается только наружу. */
function foldAt(input: OutlineInput, angle: number): number {
  return input.foldDepth * 0.5 * (1 + Math.cos(input.foldCount * angle + input.foldPhase))
}

/** Контур по готовым радиусам со складками поверх. */
function radialOutline(input: OutlineInput, radii: readonly number[]): Array<[number, number]> {
  return radii.map((radius, k) => {
    const angle = (2 * Math.PI * k) / radii.length
    const grown = radius + foldAt(input, angle)
    return [input.centerX + grown * Math.cos(angle), input.centerZ + grown * Math.sin(angle)]
  })
}

/**
 * Радиусы контура кольца по `segments` направлениям без складок: готовые или посчитанные
 * из эллипса с выпуклостями. Нужны, чтобы смешивать кольца разного происхождения.
 */
export function outlineRadii(
  input: Omit<OutlineInput, 'foldDepth' | 'foldCount' | 'foldPhase'>,
  segments: number,
): number[] {
  if (input.radii && input.radii.length === segments) return [...input.radii]
  const flat = { ...input, foldDepth: 0, foldCount: 0, foldPhase: 0, radii: undefined }
  return ringOutline(flat, segments).map(([x, z]) =>
    Math.hypot(x - input.centerX, z - input.centerZ),
  )
}
