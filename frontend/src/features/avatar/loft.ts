// «Лофт»: гладкая сетка через последовательность сечений-эллипсов (чистые функции без three.js).
import { ellipseForGirth } from './ellipse'
import type { Section } from './sections'

/** Цвет вершины в линейных долях 0..1. */
export type Rgb = readonly [number, number, number]

/** Сечение, готовое к построению: полуоси уже посчитаны, у каждого кольца свой цвет. */
export interface LoftRing {
  y: number
  a: number
  b: number
  centerX: number
  color: Rgb
}

/** Данные сетки для BufferGeometry. Координаты в сантиметрах. */
export interface MeshData {
  positions: Float32Array
  colors: Float32Array
  indices: Uint32Array
}

export interface LoftOptions {
  /** Число вершин по окружности кольца. */
  radialSegments: number
  /** Сколько промежуточных колец вставлять между соседними сечениями. */
  stepsPerSpan: number
  capBottom: boolean
  capTop: boolean
}

export const DEFAULT_LOFT: LoftOptions = {
  radialSegments: 40,
  stepsPerSpan: 5,
  capBottom: false,
  capTop: false,
}

/** Смешивает два цвета: t = 0 — первый, t = 1 — второй. */
export function mixRgb(from: Rgb, to: Rgb, t: number): Rgb {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ]
}

/** Переводит сечение с обхватом в кольцо с полуосями. */
export function toRing(section: Section, color: Rgb): LoftRing {
  const { a, b } = ellipseForGirth(section.girth, section.depthRatio)
  return { y: section.y, a, b, centerX: section.centerX, color }
}

/**
 * Сплайн Катмулла — Рома для одного числа, ограниченный значениями концов отрезка.
 * Ограничение убирает «выбросы» на резких переходах (например, от плеч к шее).
 */
function smoothValue(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  const value =
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  return Math.min(Math.max(value, Math.min(p1, p2)), Math.max(p1, p2))
}

/** Вставляет промежуточные кольца между сечениями, сглаживая форму сплайном. */
export function interpolateRings(rings: LoftRing[], stepsPerSpan: number): LoftRing[] {
  if (rings.length < 2) return [...rings]
  const result: LoftRing[] = []
  const at = (index: number) => rings[Math.min(Math.max(index, 0), rings.length - 1)] as LoftRing
  for (let i = 0; i < rings.length - 1; i += 1) {
    const [r0, r1, r2, r3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    for (let step = 0; step < stepsPerSpan; step += 1) {
      const t = step / stepsPerSpan
      const pick = (key: 'y' | 'a' | 'b' | 'centerX') =>
        smoothValue(r0[key], r1[key], r2[key], r3[key], t)
      const color = mixRgb(r1.color, r2.color, t)
      result.push({ y: pick('y'), a: pick('a'), b: pick('b'), centerX: pick('centerX'), color })
    }
  }
  result.push(rings[rings.length - 1] as LoftRing)
  return result
}

/** Добавляет «крышку» — веер треугольников от центра кольца. */
function addCap(
  positions: number[],
  colors: number[],
  indices: number[],
  ring: LoftRing,
  ringStart: number,
  segments: number,
  flip: boolean,
): void {
  const center = positions.length / 3
  positions.push(ring.centerX, ring.y, 0)
  colors.push(...ring.color)
  for (let k = 0; k < segments; k += 1) {
    const current = ringStart + k
    const next = ringStart + ((k + 1) % segments)
    if (flip) indices.push(center, next, current)
    else indices.push(center, current, next)
  }
}

/** Строит сетку через кольца: вершины колец и по два треугольника на каждый «квадрат». */
export function loftMesh(sourceRings: LoftRing[], options: LoftOptions = DEFAULT_LOFT): MeshData {
  const rings = interpolateRings(sourceRings, options.stepsPerSpan)
  const segments = options.radialSegments
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  for (const ring of rings) {
    for (let k = 0; k < segments; k += 1) {
      const angle = (2 * Math.PI * k) / segments
      positions.push(ring.centerX + ring.a * Math.cos(angle), ring.y, ring.b * Math.sin(angle))
      colors.push(...ring.color)
    }
  }
  for (let i = 0; i < rings.length - 1; i += 1) {
    for (let k = 0; k < segments; k += 1) {
      const current = i * segments + k
      const next = i * segments + ((k + 1) % segments)
      indices.push(current, current + segments, next, next, current + segments, next + segments)
    }
  }
  const first = rings[0]
  const last = rings[rings.length - 1]
  if (options.capBottom && first) addCap(positions, colors, indices, first, 0, segments, false)
  if (options.capTop && last) {
    addCap(positions, colors, indices, last, (rings.length - 1) * segments, segments, true)
  }
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
  }
}
