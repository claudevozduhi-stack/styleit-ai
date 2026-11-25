// «Лофт»: гладкая сетка через последовательность сечений (чистые функции без three.js).
// Каждое кольцо — эллипс с анатомическими выпуклостями и складками (см. profile.ts).
import { ellipseForGirth } from './ellipse'
import { addCap, buildGrid } from './loftGrid'
import { NO_FEATURES, type Features } from './profile'
import type { Section } from './sections'

/** Цвет вершины в линейных долях 0..1. */
export type Rgb = readonly [number, number, number]

/** Сечение, готовое к построению: полуоси посчитаны, у каждого кольца свой цвет. */
export interface LoftRing {
  y: number
  a: number
  b: number
  centerX: number
  centerZ: number
  color: Rgb
  features: Features
  /** Глубина складок ткани в сантиметрах (у тела 0). */
  foldDepth: number
}

/** Данные сетки для BufferGeometry. Координаты в сантиметрах. */
export interface MeshData {
  positions: Float32Array
  normals: Float32Array
  colors: Float32Array
  /** Развёртка для фактуры ткани: u — по окружности, v — по высоте (1 = 10 см). */
  uvs: Float32Array
  indices: Uint32Array
}

export interface LoftOptions {
  /** Число вершин по окружности кольца. */
  radialSegments: number
  /** Сколько промежуточных колец вставлять между соседними сечениями. */
  stepsPerSpan: number
  capBottom: boolean
  capTop: boolean
  /** Число складок по окружности (у ткани). */
  foldCount: number
  /** Толщина ткани у открытых краёв: подол, манжеты, горловина (0 — без подгиба). */
  edgeThickness: number
}

export const DEFAULT_LOFT: LoftOptions = {
  radialSegments: 48,
  stepsPerSpan: 5,
  capBottom: false,
  capTop: false,
  foldCount: 0,
  edgeThickness: 0,
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
export function toRing(section: Section, color: Rgb, foldDepth = 0): LoftRing {
  const { a, b } = ellipseForGirth(section.girth, section.depthRatio)
  return {
    y: section.y,
    a,
    b,
    centerX: section.centerX,
    centerZ: section.centerZ ?? 0,
    color,
    features: section.features ?? NO_FEATURES,
    foldDepth,
  }
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

/** Линейно смешивает выпуклости двух колец. */
function mixFeatures(from: Features, to: Features, t: number): Features {
  const mix = (key: keyof Features) => from[key] + (to[key] - from[key]) * t
  return {
    bust: mix('bust'),
    buttocks: mix('buttocks'),
    shoulderBlades: mix('shoulderBlades'),
    belly: mix('belly'),
  }
}

type SmoothKey = 'y' | 'a' | 'b' | 'centerX' | 'centerZ'

/** Вставляет промежуточные кольца между сечениями, сглаживая форму сплайном. */
export function interpolateRings(rings: LoftRing[], stepsPerSpan: number): LoftRing[] {
  if (rings.length < 2) return [...rings]
  const result: LoftRing[] = []
  const at = (index: number) => rings[Math.min(Math.max(index, 0), rings.length - 1)] as LoftRing
  for (let i = 0; i < rings.length - 1; i += 1) {
    const [r0, r1, r2, r3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    for (let step = 0; step < stepsPerSpan; step += 1) {
      const t = step / stepsPerSpan
      const pick = (key: SmoothKey) => smoothValue(r0[key], r1[key], r2[key], r3[key], t)
      result.push({
        y: pick('y'),
        a: pick('a'),
        b: pick('b'),
        centerX: pick('centerX'),
        centerZ: pick('centerZ'),
        color: mixRgb(r1.color, r2.color, t),
        features: mixFeatures(r1.features, r2.features, t),
        foldDepth: r1.foldDepth + (r2.foldDepth - r1.foldDepth) * t,
      })
    }
  }
  result.push(rings[rings.length - 1] as LoftRing)
  return result
}

/** Подгиб ткани на открытом краю: кольцо чуть внутри и выше (или ниже) края. */
function hemRing(edge: LoftRing, thickness: number, direction: 1 | -1): LoftRing {
  return {
    ...edge,
    y: edge.y + direction * thickness,
    a: Math.max(edge.a - thickness, 0.1),
    b: Math.max(edge.b - thickness, 0.1),
    foldDepth: 0,
  }
}

/** Кольца для построения: сглаженные, с подгибами на открытых краях. */
function prepareRings(source: LoftRing[], options: LoftOptions): LoftRing[] {
  const rings = interpolateRings(source, options.stepsPerSpan)
  const first = rings[0]
  const last = rings[rings.length - 1]
  if (options.edgeThickness <= 0 || !first || !last) return rings
  const thickness = options.edgeThickness
  return [
    ...(options.capBottom ? [] : [hemRing(first, thickness, 1)]),
    ...rings,
    ...(options.capTop ? [] : [hemRing(last, thickness, -1)]),
  ]
}

/** Строит сетку через кольца: вершины, нормали, развёртку и по два треугольника на «квадрат». */
export function loftMesh(sourceRings: LoftRing[], options: LoftOptions = DEFAULT_LOFT): MeshData {
  const rings = prepareRings(sourceRings, options)
  const grid = buildGrid(rings, options.radialSegments, options.foldCount)
  const first = rings[0]
  const last = rings[rings.length - 1]
  if (options.capBottom && first) addCap(grid, first, 0, options.radialSegments, -1)
  if (options.capTop && last) addCap(grid, last, rings.length - 1, options.radialSegments, 1)
  return {
    positions: new Float32Array(grid.positions),
    normals: new Float32Array(grid.normals),
    colors: new Float32Array(grid.colors),
    uvs: new Float32Array(grid.uvs),
    indices: new Uint32Array(grid.indices),
  }
}
