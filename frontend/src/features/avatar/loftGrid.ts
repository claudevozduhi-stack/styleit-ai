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

/** Сколько сантиметров по высоте приходится на один повтор фактуры ткани. */
const TEXTURE_HEIGHT_CM = 10

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

/** Строит вершины всех колец (с дублем шва для развёртки) и треугольники между ними. */
export function buildGrid(rings: LoftRing[], segments: number, foldCount: number): Grid {
  const grid: Grid = { positions: [], normals: [], colors: [], uvs: [], indices: [] }
  const columns = segments + 1
  for (const ring of rings) {
    const outline = ringOutline({ ...ring, foldCount, foldPhase: foldPhase(ring.y) }, segments)
    for (let k = 0; k <= segments; k += 1) {
      const [x, z] = outline[k % segments] as [number, number]
      grid.positions.push(x, ring.y, z)
      grid.colors.push(...ring.color)
      grid.uvs.push(k / segments, ring.y / TEXTURE_HEIGHT_CM)
    }
  }
  for (let i = 0; i < rings.length - 1; i += 1) {
    for (let k = 0; k < segments; k += 1) {
      const current = i * columns + k
      const above = current + columns
      grid.indices.push(current, above, current + 1, current + 1, above, above + 1)
    }
  }
  grid.normals = gridNormals(grid.positions, rings.length, segments)
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
  grid.uvs.push(0.5, ring.y / TEXTURE_HEIGHT_CM)
  for (let k = 0; k < segments; k += 1) {
    if (side === 1) grid.indices.push(center, start + k + 1, start + k)
    else grid.indices.push(center, start + k, start + k + 1)
  }
}
