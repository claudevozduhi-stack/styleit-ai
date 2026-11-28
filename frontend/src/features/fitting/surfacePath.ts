// Линии по поверхности детали одежды: вдоль высоты (боковой шов) и вдоль края (строчка
// подола). Точки берутся прямо из решётки лофта, поэтому линия ложится в складки ткани.
import type { GridLayout, MeshData, Rgb } from '../avatar/loft'

export type Vec3 = [number, number, number]

/** Точка на поверхности: положение, нормаль наружу и цвет ткани в этом месте (sRGB). */
export interface SurfacePoint {
  position: Vec3
  normal: Vec3
  color: Rgb
}

/** Читает три числа из массива по номеру вершины. */
function triple(array: Float32Array, index: number): Vec3 {
  return [
    array[index * 3] as number,
    array[index * 3 + 1] as number,
    array[index * 3 + 2] as number,
  ]
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function length(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2])
}

export function normalize(vector: Vec3): Vec3 {
  const size = length(vector) || 1
  return [vector[0] / size, vector[1] / size, vector[2] / size]
}

/** Линейная смесь двух точек поверхности (нормаль после смеси снова единичная). */
export function mixPoints(a: SurfacePoint, b: SurfacePoint, t: number): SurfacePoint {
  const mix = (x: number, y: number) => x + (y - x) * t
  return {
    position: [
      mix(a.position[0], b.position[0]),
      mix(a.position[1], b.position[1]),
      mix(a.position[2], b.position[2]),
    ],
    normal: normalize([
      mix(a.normal[0], b.normal[0]),
      mix(a.normal[1], b.normal[1]),
      mix(a.normal[2], b.normal[2]),
    ]),
    color: [mix(a.color[0], b.color[0]), mix(a.color[1], b.color[1]), mix(a.color[2], b.color[2])],
  }
}

/** Вершина решётки: кольцо row, столбец column (по модулю числа столбцов без шва). */
export function gridPoint(
  mesh: MeshData,
  layout: GridLayout,
  row: number,
  column: number,
): SurfacePoint {
  const around = layout.columns - 1
  const index = row * layout.columns + (((column % around) + around) % around)
  const [r, g, b] = triple(mesh.colors, index)
  return {
    position: triple(mesh.positions, index),
    normal: triple(mesh.normals, index),
    color: [r, g, b],
  }
}

/** Сдвигает точку кольца row вдоль окружности на offsetCm (знак — направление обхода). */
function shiftedAround(
  mesh: MeshData,
  layout: GridLayout,
  row: number,
  column: number,
  offsetCm: number,
): SurfacePoint {
  const point = gridPoint(mesh, layout, row, column)
  if (offsetCm === 0) return point
  const ahead = gridPoint(mesh, layout, row, column + 1).position
  const behind = gridPoint(mesh, layout, row, column - 1).position
  const tangent = normalize(subtract(ahead, behind))
  return {
    ...point,
    position: [
      point.position[0] + tangent[0] * offsetCm,
      point.position[1] + tangent[1] * offsetCm,
      point.position[2] + tangent[2] * offsetCm,
    ],
  }
}

/** Линия вдоль высоты детали по столбцу column, сдвинутая вдоль окружности на offsetCm. */
export function columnPath(
  mesh: MeshData,
  layout: GridLayout,
  column: number,
  offsetCm = 0,
): SurfacePoint[] {
  const path: SurfacePoint[] = []
  for (let row = layout.firstRow; row <= layout.lastRow; row += 1) {
    path.push(shiftedAround(mesh, layout, row, column, offsetCm))
  }
  return path
}

/**
 * Точка на расстоянии distanceCm от края по поверхности: идём по столбцу от кольца edgeRow
 * внутрь детали (direction +1 — вверх, −1 — вниз) и считаем пройденную длину.
 */
function pointFromEdge(
  mesh: MeshData,
  layout: GridLayout,
  edgeRow: number,
  direction: 1 | -1,
  column: number,
  distanceCm: number,
): SurfacePoint {
  let current = gridPoint(mesh, layout, edgeRow, column)
  let walked = 0
  for (
    let row = edgeRow + direction;
    row >= layout.firstRow && row <= layout.lastRow;
    row += direction
  ) {
    const next = gridPoint(mesh, layout, row, column)
    const step = length(subtract(next.position, current.position))
    if (walked + step >= distanceCm && step > 0) {
      return mixPoints(current, next, (distanceCm - walked) / step)
    }
    walked += step
    current = next
  }
  return current
}

/**
 * Замкнутая линия вдоль открытого края (подол, манжета, горловина, пояс) на расстоянии
 * distanceCm от него. side: 'bottom' — нижний край детали, 'top' — верхний.
 */
export function edgePath(
  mesh: MeshData,
  layout: GridLayout,
  side: 'bottom' | 'top',
  distanceCm: number,
): SurfacePoint[] {
  const edgeRow = side === 'bottom' ? layout.firstRow : layout.lastRow
  const direction = side === 'bottom' ? 1 : -1
  const path: SurfacePoint[] = []
  for (let column = 0; column < layout.columns; column += 1) {
    path.push(pointFromEdge(mesh, layout, edgeRow, direction, column, distanceCm))
  }
  return path
}

/** Замкнутая линия по кольцу row: например, пройма — граница рукава и оката над плечом. */
export function rowPath(mesh: MeshData, layout: GridLayout, row: number): SurfacePoint[] {
  return Array.from({ length: layout.columns }, (_, column) => gridPoint(mesh, layout, row, column))
}
