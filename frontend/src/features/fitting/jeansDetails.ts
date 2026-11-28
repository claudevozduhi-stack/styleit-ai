// Детали джинсов, нарисованные строчкой по поверхности: кокетка, задние и передние карманы,
// гульфик и средние швы. Формы общие для джинсов любых марок, без узнаваемых
// фирменных узоров (декоративную строчку на карманах не рисуем).
import type { GridLayout, MeshData } from '../avatar/loft'
import type { GarmentPart } from './garment'
import { SEAM_LINE, WAISTBAND_SEAM_CM, addLine, stitchLine, type TrimBuffer } from './seams'
import { columnLength, edgePath, pathLength, pointBelowTop, type SurfacePoint } from './surfacePath'

/** Точка выкройки: сдвиг от середины (переда или спинки) по окружности и глубина от пояса, см. */
type PatternPoint = readonly [number, number]

/** Сколько точек на сантиметр линии: плавно даже на изгибах кармана. */
const SAMPLES_PER_CM = 1.5

/** Высота задней части джинсов, под которую нарисованы карманы и кокетка, см. */
const REFERENCE_BACK_CM = 28

/** Двойная строчка рядом со швом: расстояния от шва, см. */
const DOUBLE_ROWS = [0.45, 0.85]

/** Детали рисуются на детали «туловище» джинсов: в развёртке её перед и спинка. */
interface JeansCanvas {
  mesh: MeshData
  layout: GridLayout
  /** Столбец середины переда (+Z) и спинки (−Z). */
  front: number
  back: number
  /** Сантиметров по окружности на один столбец на глубине d от пояса. */
  spacing: (depthCm: number) => number
  /** Сколько сантиметров по спинке от пояса до низа детали. */
  backLength: number
}

/** Готовит «холст»: середины переда и спинки, шаг столбцов по глубине (с запоминанием). */
function jeansCanvas(mesh: MeshData, layout: GridLayout): JeansCanvas {
  const around = layout.columns - 1
  const cache = new Map<number, number>()
  const spacing = (depthCm: number) => {
    const key = Math.round(depthCm * 2) / 2
    const known = cache.get(key)
    if (known !== undefined) return known
    // Окружность на этой глубине: замкнутая линия на расстоянии от верхнего края.
    const perimeter = pathLength(edgePath(mesh, layout, 'top', key))
    const value = perimeter / around || 1
    cache.set(key, value)
    return value
  }
  const back = (around * 3) / 4
  return {
    mesh,
    layout,
    front: around / 4,
    back,
    spacing,
    backLength: columnLength(mesh, layout, back),
  }
}

/** Точка выкройки на поверхности: offset вдоль окружности от середины center, depth — от пояса. */
function surfacePoint(canvas: JeansCanvas, center: number, point: PatternPoint): SurfacePoint {
  const [offset, depth] = point
  const column = center + offset / canvas.spacing(depth)
  return pointBelowTop(canvas.mesh, canvas.layout, column, depth)
}

/** Ломаная выкройки → точки поверхности, с промежуточными точками для плавности. */
function patternPath(
  canvas: JeansCanvas,
  center: number,
  points: PatternPoint[],
  closed = false,
): SurfacePoint[] {
  const corners = closed ? [...points, points[0] as PatternPoint] : points
  const path: SurfacePoint[] = []
  for (let index = 0; index + 1 < corners.length; index += 1) {
    const [x0, y0] = corners[index] as PatternPoint
    const [x1, y1] = corners[index + 1] as PatternPoint
    const steps = Math.max(Math.ceil(Math.hypot(x1 - x0, y1 - y0) * SAMPLES_PER_CM), 1)
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps
      path.push(surfacePoint(canvas, center, [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]))
    }
  }
  const last = corners[corners.length - 1] as PatternPoint
  path.push(surfacePoint(canvas, center, last))
  return path
}

/** Плавная кривая по формуле: shape(t) для t от 0 до 1. */
function curve(shape: (t: number) => PatternPoint, samples = 24): PatternPoint[] {
  return Array.from({ length: samples + 1 }, (_, index) => shape(index / samples))
}

/** Шов с двойной отстрочкой: сама линия и две строчки, сдвинутые по глубине вниз. */
function seamWithRows(
  buffer: TrimBuffer,
  canvas: JeansCanvas,
  center: number,
  line: PatternPoint[],
) {
  addLine(buffer, patternPath(canvas, center, line), SEAM_LINE)
  for (const row of DOUBLE_ROWS) {
    const shifted = line.map(([offset, depth]) => [offset, depth + row] as const)
    addLine(buffer, patternPath(canvas, center, shifted), stitchLine(true))
  }
}

/** Кокетка спинки: V-образный шов от боковых швов к середине, ниже пояса. */
function addYoke(buffer: TrimBuffer, canvas: JeansCanvas, scale: number): void {
  const half = canvas.spacing(6) * ((canvas.layout.columns - 1) / 4)
  const line = curve((t) => {
    const offset = -half + 2 * half * t
    return [offset, (9 - 3.5 * (Math.abs(offset) / half)) * scale]
  })
  seamWithRows(buffer, canvas, canvas.back, line)
}

/** Задний накладной карман: пятиугольник, его край (шов) и две строчки по краю и сверху. */
function addBackPocket(buffer: TrimBuffer, canvas: JeansCanvas, shift: number, scale: number) {
  const outline = (inset: number): PatternPoint[] => {
    const halfWidth = 6.75 - inset
    const top = (11 + inset) * scale
    const side = (23.5 - inset) * scale
    const tip = (26 - inset * 1.4) * scale
    return [
      [shift - halfWidth, top],
      [shift + halfWidth, top],
      [shift + halfWidth, side],
      [shift, tip],
      [shift - halfWidth, side],
    ]
  }
  addLine(buffer, patternPath(canvas, canvas.back, outline(0), true), SEAM_LINE)
  for (const inset of [0.3, 0.7]) {
    addLine(buffer, patternPath(canvas, canvas.back, outline(inset), true), stitchLine(true))
  }
  // Подгибка верха кармана.
  const hem = (11 + 1.3) * scale
  addLine(
    buffer,
    patternPath(canvas, canvas.back, [
      [shift - 6.4, hem],
      [shift + 6.4, hem],
    ]),
    stitchLine(true),
  )
}

/** Вход в передний карман: изогнутый срез от пояса к боковому шву. */
function addFrontPocket(buffer: TrimBuffer, canvas: JeansCanvas, side: 1 | -1): void {
  const toSide = canvas.spacing(8) * ((canvas.layout.columns - 1) / 4)
  const start = 9.5
  const line = curve((t) => [
    side * (start + (toSide - start) * t),
    WAISTBAND_SEAM_CM + 6 * Math.sin((t * Math.PI) / 2),
  ])
  seamWithRows(buffer, canvas, canvas.front, line)
}

/** Гульфик: J-образная двойная строчка и средний шов переда. */
function addFly(buffer: TrimBuffer, canvas: JeansCanvas): void {
  for (const width of [3.2, 3.7]) {
    const line = curve((t) => {
      // Прямой участок вниз, затем дуга к середине.
      if (t < 0.7) return [width, WAISTBAND_SEAM_CM + (t / 0.7) * 11]
      const angle = ((t - 0.7) / 0.3) * (Math.PI / 2)
      return [width * Math.cos(angle), WAISTBAND_SEAM_CM + 11 + width * Math.sin(angle)]
    })
    addLine(buffer, patternPath(canvas, canvas.front, line), stitchLine(true))
  }
}

/** Средний шов: от пояса (или кокетки) вниз до шагового шва. */
function addCenterSeam(buffer: TrimBuffer, canvas: JeansCanvas, center: number, from: number) {
  const to = columnLength(canvas.mesh, canvas.layout, Math.round(center)) - 0.5
  if (to <= from) return
  addLine(
    buffer,
    patternPath(canvas, center, [
      [0, from],
      [0, to],
    ]),
    SEAM_LINE,
  )
}

/**
 * Рисует детали джинсов на туловищной части (у штанин их нет).
 * Подходит как дополнение для garmentTrims.
 */
export function addJeansDetails(buffer: TrimBuffer, part: GarmentPart, mesh: MeshData): void {
  const layout = mesh.layout
  if (part.kind !== 'torso' || !layout || !layout.openTop) return
  const canvas = jeansCanvas(mesh, layout)
  // На невысокой детали карманы и кокетка пропорционально меньше.
  const scale = Math.min(canvas.backLength / REFERENCE_BACK_CM, 1)
  addYoke(buffer, canvas, scale)
  for (const shift of [-9, 9]) addBackPocket(buffer, canvas, shift * scale, scale)
  addCenterSeam(buffer, canvas, canvas.back, 9 * scale)
  for (const side of [1, -1] as const) addFrontPocket(buffer, canvas, side)
  addFly(buffer, canvas)
  addCenterSeam(buffer, canvas, canvas.front, WAISTBAND_SEAM_CM)
}
