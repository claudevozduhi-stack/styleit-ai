// Сетка-«решётка» лофта: вершины колец, нормали, развёртка, треугольники и крышки.
import type { LoftRing } from './loft'
import { ringOutline } from './profile'

/** Изменяемые массивы сетки, которые потом упаковываются в типизированные массивы. */
export interface Grid {
  positions: number[]
  normals: number[]
  colors: number[]
  uvs: number[]
  indices: number[]
}

/**
 * Сколько сантиметров ткани приходится на единицу развёртки (UV) — и по высоте, и по кругу.
 * Масштаб фактуры конкретной ткани задаётся повтором текстуры (FABRIC_LOOK.tileCm).
 */
export const TEXTURE_UNIT_CM = 10

/** Насколько светлеет натянутая ткань при натяжении 1 (нить растянута, просвечивает основа). */
const STRAIN_LIGHTEN = 0.18
/** Яркость поперечных складок натяжения и их шаг по высоте, см. */
const STRAIN_LINES = 0.07
const STRAIN_LINE_STEP_CM = 2.2

/**
 * Цвет натянутой ткани на высоте y: светлее и с поперечными полосами — так видны
 * складки натяжения, которые расходятся от тесной зоны.
 */
export function strainedColor(color: LoftRing['color'], strain: number, y: number): number[] {
  if (strain <= 0) return [...color]
  const lines = 0.5 + 0.5 * Math.sin((2 * Math.PI * y) / STRAIN_LINE_STEP_CM)
  const lift = strain * (STRAIN_LIGHTEN + STRAIN_LINES * (lines - 0.5))
  return color.map((channel) => Math.min(channel + (1 - channel) * lift, 1))
}

/** Фаза складок плавно меняется по высоте: складки «гуляют», а не идут ровными рёбрами. */
function foldPhase(y: number): number {
  return 0.9 * Math.sin(y * 0.11)
}

/** Читает вершину решётки (кольцо i, столбец k) как тройку чисел. */
function vertex(
  positions: number[],
  columns: number,
  i: number,
  k: number,
): [number, number, number] {
  const offset = (i * columns + k) * 3
  return [
    positions[offset] as number,
    positions[offset + 1] as number,
    positions[offset + 2] as number,
  ]
}

/**
 * Нормали по соседям в решётке: вектор «по кругу» × вектор «вверх».
 * Шов (последний столбец — копия первого) получает ту же нормаль, поэтому освещение без полосы.
 */
export function gridNormals(positions: number[], ringCount: number, segments: number): number[] {
  const columns = segments + 1
  const normals: number[] = []
  for (let i = 0; i < ringCount; i += 1) {
    for (let k = 0; k <= segments; k += 1) {
      const column = k % segments
      const ahead = vertex(positions, columns, i, (column + 1) % segments)
      const behind = vertex(positions, columns, i, (column - 1 + segments) % segments)
      const above = vertex(positions, columns, Math.min(i + 1, ringCount - 1), column)
      const below = vertex(positions, columns, Math.max(i - 1, 0), column)
      const around = [ahead[0] - behind[0], ahead[1] - behind[1], ahead[2] - behind[2]]
      const up = [above[0] - below[0], above[1] - below[1], above[2] - below[2]]
      // up × around смотрит наружу при обходе контура от +X к +Z.
      const nx =
        (up[1] as number) * (around[2] as number) - (up[2] as number) * (around[1] as number)
      const ny =
        (up[2] as number) * (around[0] as number) - (up[0] as number) * (around[2] as number)
      const nz =
        (up[0] as number) * (around[1] as number) - (up[1] as number) * (around[0] as number)
      const length = Math.hypot(nx, ny, nz) || 1
      normals.push(nx / length, ny / length, nz / length)
    }
  }
  return normals
}

/** Длина замкнутого контура, см. */
function perimeter(outline: Array<[number, number]>): number {
  let length = 0
  for (let k = 0; k < outline.length; k += 1) {
    const [x0, z0] = outline[k] as [number, number]
    const [x1, z1] = outline[(k + 1) % outline.length] as [number, number]
    length += Math.hypot(x1 - x0, z1 - z0)
  }
  return length
}

/**
 * Координата u развёртки вдоль контура: по длине дуги, а не по углу, чтобы нити шли с
 * одинаковым шагом и на узких, и на широких местах. На шве u равно целому числу повторов
 * (общему для всей детали), поэтому рисунок ткани смыкается без разрыва.
 */
export function arcLengthU(outline: Array<[number, number]>, tilesAround: number): number[] {
  const total = perimeter(outline) || 1
  const result = [0]
  let length = 0
  for (let k = 1; k <= outline.length; k += 1) {
    const [x0, z0] = outline[k - 1] as [number, number]
    const [x1, z1] = outline[k % outline.length] as [number, number]
    length += Math.hypot(x1 - x0, z1 - z0)
    result.push((length / total) * tilesAround)
  }
  return result
}

/** Сколько единиц развёртки укладывается по кругу детали: по среднему обхвату, минимум одна. */
export function tilesAroundFor(outlines: Array<Array<[number, number]>>): number {
  if (outlines.length === 0) return 1
  const mean = outlines.reduce((sum, outline) => sum + perimeter(outline), 0) / outlines.length
  return Math.max(Math.round(mean / TEXTURE_UNIT_CM), 1)
}

/** Сколько раз нормали сглаживаются по высоте: убирает «полосы» бликов между кольцами. */
const NORMAL_SMOOTH_PASSES = 24

/**
 * Сглаживает нормали вдоль высоты (каждая — среднее с кольцом выше и ниже).
 * Мелкие ступеньки радиуса между кольцами иначе дают на гладкой и тёмной ткани
 * горизонтальные полосы блика; складки идут вдоль высоты, поэтому они сохраняются.
 */
export function smoothNormalsVertically(
  normals: number[],
  ringCount: number,
  columns: number,
  passes = NORMAL_SMOOTH_PASSES,
): number[] {
  let current = normals
  for (let pass = 0; pass < passes; pass += 1) {
    const next = current.slice()
    for (let i = 1; i < ringCount - 1; i += 1) {
      for (let k = 0; k < columns; k += 1) {
        const offset = (i * columns + k) * 3
        const sum = [0, 1, 2].map(
          (axis) =>
            (current[offset - columns * 3 + axis] as number) +
            2 * (current[offset + axis] as number) +
            (current[offset + columns * 3 + axis] as number),
        )
        const length = Math.hypot(sum[0] as number, sum[1] as number, sum[2] as number) || 1
        for (let axis = 0; axis < 3; axis += 1) next[offset + axis] = (sum[axis] as number) / length
      }
    }
    current = next
  }
  return current
}

/** Строит вершины всех колец (с дублем шва для развёртки) и треугольники между ними. */
export function buildGrid(rings: LoftRing[], segments: number, foldCount: number): Grid {
  const grid: Grid = { positions: [], normals: [], colors: [], uvs: [], indices: [] }
  const columns = segments + 1
  const outlines = rings.map((ring) =>
    ringOutline({ ...ring, foldCount, foldPhase: foldPhase(ring.y) }, segments),
  )
  const tilesAround = tilesAroundFor(outlines)
  rings.forEach((ring, index) => {
    const outline = outlines[index] as Array<[number, number]>
    const around = arcLengthU(outline, tilesAround)
    for (let k = 0; k <= segments; k += 1) {
      const [x, z] = outline[k % segments] as [number, number]
      grid.positions.push(x, ring.y, z)
      grid.colors.push(...strainedColor(ring.color, ring.strain ?? 0, ring.y))
      grid.uvs.push(around[k] as number, ring.y / TEXTURE_UNIT_CM)
    }
  })
  for (let i = 0; i < rings.length - 1; i += 1) {
    for (let k = 0; k < segments; k += 1) {
      const current = i * columns + k
      const above = current + columns
      grid.indices.push(current, above, current + 1, current + 1, above, above + 1)
    }
  }
  grid.normals = smoothNormalsVertically(
    gridNormals(grid.positions, rings.length, segments),
    rings.length,
    columns,
  )
  return grid
}

/** Закрывает конец «крышкой» — веером треугольников от центра кольца. side: −1 низ, +1 верх. */
export function addCap(
  grid: Grid,
  ring: LoftRing,
  ringIndex: number,
  segments: number,
  side: 1 | -1,
): void {
  const center = grid.positions.length / 3
  const start = ringIndex * (segments + 1)
  grid.positions.push(ring.centerX, ring.y, ring.centerZ)
  grid.normals.push(0, side, 0)
  grid.colors.push(...ring.color)
  grid.uvs.push(0.5, ring.y / TEXTURE_UNIT_CM)
  for (let k = 0; k < segments; k += 1) {
    if (side === 1) grid.indices.push(center, start + k + 1, start + k)
    else grid.indices.push(center, start + k, start + k + 1)
  }
}
