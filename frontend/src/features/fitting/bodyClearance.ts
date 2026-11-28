// Последняя проверка одежды по настоящему телу: если вершина тела-скана оказалась снаружи
// ткани (у подмышки, плеча, на изгибе между сечениями), ткань в этом месте отодвигается
// наружу. Так манекен не просвечивает ни при каком размере.
import { gridNormals, smoothNormalsVertically } from '../avatar/loftGrid'
import type { MeshData } from '../avatar/loft'
import { PART } from '../avatar/humanModel'
import type { BodySurface } from '../avatar/sections'
import type { GarmentPartKind } from './garment'

/** Минимальный зазор между тканью и телом, см. */
export const BODY_CLEARANCE_CM = 0.4
/** Сколько секторов по окружности при поиске самой выступающей точки тела. */
const SECTORS = 96
/** Проходы сглаживания сдвига: ткань выпирает плавно, без «шипов». */
const SPREAD_PASSES = 3

/** Часть тела, которую закрывает деталь одежды своей стороны (рукав — руку, штанина — ногу). */
function partUnder(kind: GarmentPartKind, side: number): number {
  if (kind === 'torso') return PART.torso
  if (kind === 'sleeve') return side > 0 ? PART.armPositiveX : PART.armNegativeX
  return side > 0 ? PART.legPositiveX : PART.legNegativeX
}

/** Какие части тела должна закрывать деталь одежды. */
function coveredParts(kind: GarmentPartKind, side: number): Set<number> {
  if (kind === 'torso') return new Set([PART.torso, PART.legPositiveX, PART.legNegativeX])
  return new Set([partUnder(kind, side)])
}

/**
 * Поверхность «тело + надетая деталь»: вершины решётки детали добавляются к телу с номером
 * той части тела, которую деталь закрывает. Следующий слой одежды отодвигается уже от неё.
 */
export function wearOnSurface(
  surface: BodySurface,
  mesh: MeshData,
  kind: GarmentPartKind,
): BodySurface {
  const layout = mesh.layout
  if (!layout) return surface
  const gridCount = layout.rows * layout.columns
  const side = ringCenter(mesh.positions, layout.firstRow, layout.columns)[0]
  const positions = new Float32Array((surface.count + gridCount) * 3)
  positions.set(surface.positions.subarray(0, surface.count * 3))
  positions.set(mesh.positions.subarray(0, gridCount * 3), surface.count * 3)
  const parts = new Uint8Array(surface.count + gridCount)
  parts.set(surface.parts.subarray(0, surface.count))
  parts.fill(partUnder(kind, side), surface.count)
  return { positions, parts, count: surface.count + gridCount }
}

/** Вершины тела нужных частей, отсортированные по высоте, — для быстрого поиска полосы. */
interface SortedVertices {
  y: Float32Array
  x: Float32Array
  z: Float32Array
}

function sortedVertices(surface: BodySurface, parts: Set<number>): SortedVertices {
  const count = Math.min(surface.count, surface.parts.length)
  const order: number[] = []
  for (let vertex = 0; vertex < count; vertex += 1) {
    if (parts.has(surface.parts[vertex] as number)) order.push(vertex)
  }
  order.sort(
    (a, b) => (surface.positions[a * 3 + 1] as number) - (surface.positions[b * 3 + 1] as number),
  )
  const pick = (axis: number) =>
    Float32Array.from(order, (vertex) => surface.positions[vertex * 3 + axis] as number)
  return { x: pick(0), y: pick(1), z: pick(2) }
}

/** Первый номер вершины с высотой не меньше y (двоичный поиск). */
function lowerBound(values: Float32Array, y: number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const middle = (low + high) >> 1
    if ((values[middle] as number) < y) low = middle + 1
    else high = middle
  }
  return low
}

/** Самый дальний от центра выступ тела по секторам в полосе высот [low, high]. */
function bodyRadii(
  vertices: SortedVertices,
  low: number,
  high: number,
  centerX: number,
  centerZ: number,
): Float32Array {
  const radii = new Float32Array(SECTORS)
  for (let index = lowerBound(vertices.y, low); index < vertices.y.length; index += 1) {
    if ((vertices.y[index] as number) > high) break
    const dx = (vertices.x[index] as number) - centerX
    const dz = (vertices.z[index] as number) - centerZ
    const angle = Math.atan2(dz, dx)
    const sector = Math.floor(((angle / (2 * Math.PI) + 1) % 1) * SECTORS) % SECTORS
    radii[sector] = Math.max(radii[sector] as number, Math.hypot(dx, dz))
  }
  return radii
}

/** Сглаживает сдвиги по кольцу и по высоте, не уменьшая их (максимум с затухающим соседом). */
function spreadPushes(pushes: Float32Array, rows: number, around: number): void {
  for (let pass = 0; pass < SPREAD_PASSES; pass += 1) {
    const source = pushes.slice()
    for (let row = 0; row < rows; row += 1) {
      for (let k = 0; k < around; k += 1) {
        const neighbours = [
          source[row * around + ((k + 1) % around)] as number,
          source[row * around + ((k - 1 + around) % around)] as number,
          row > 0 ? (source[(row - 1) * around + k] as number) : 0,
          row + 1 < rows ? (source[(row + 1) * around + k] as number) : 0,
        ]
        pushes[row * around + k] = Math.max(
          source[row * around + k] as number,
          ...neighbours.map((value) => value * 0.6),
        )
      }
    }
  }
}

/** Центры колец решётки (среднее вершин кольца без шва). */
function ringCenter(
  positions: Float32Array,
  row: number,
  columns: number,
): [number, number, number] {
  let x = 0
  let y = 0
  let z = 0
  const around = columns - 1
  for (let k = 0; k < around; k += 1) {
    const offset = (row * columns + k) * 3
    x += positions[offset] as number
    y += positions[offset + 1] as number
    z += positions[offset + 2] as number
  }
  return [x / around, y / around, z / around]
}

/**
 * Отодвигает ткань детали от тела там, где тело выходит наружу или подходит ближе
 * BODY_CLEARANCE_CM. Работает по кольцам решётки лофта; нормали пересчитываются.
 */
export function clearBody(mesh: MeshData, kind: GarmentPartKind, surface: BodySurface): MeshData {
  const layout = mesh.layout
  if (!layout) return mesh
  const { columns, firstRow, lastRow, rows } = layout
  const around = columns - 1
  const centers = Array.from({ length: rows }, (_, row) => ringCenter(mesh.positions, row, columns))
  const side = centers[firstRow]?.[0] ?? 0
  const vertices = sortedVertices(surface, coveredParts(kind, side))
  const pushes = new Float32Array(rows * around)
  for (let row = firstRow; row <= lastRow; row += 1) {
    const [centerX, centerY, centerZ] = centers[row] as [number, number, number]
    const below = centers[Math.max(row - 1, firstRow)]?.[1] ?? centerY
    const above = centers[Math.min(row + 1, lastRow)]?.[1] ?? centerY
    // Полоса высот до соседних колец: на наклоне (плечо) тело между кольцами тоже учтено.
    const radii = bodyRadii(vertices, below, above, centerX, centerZ)
    for (let k = 0; k < around; k += 1) {
      const offset = (row * columns + k) * 3
      const dx = (mesh.positions[offset] as number) - centerX
      const dz = (mesh.positions[offset + 2] as number) - centerZ
      const sector = Math.floor(((Math.atan2(dz, dx) / (2 * Math.PI) + 1) % 1) * SECTORS) % SECTORS
      const needed = Math.max(
        radii[(sector + SECTORS - 1) % SECTORS] as number,
        radii[sector] as number,
        radii[(sector + 1) % SECTORS] as number,
      )
      pushes[row * around + k] = Math.max(needed + BODY_CLEARANCE_CM - Math.hypot(dx, dz), 0)
    }
  }
  if (!pushes.some((value) => value > 0)) return mesh
  spreadPushes(pushes, rows, around)
  const positions = mesh.positions.slice()
  for (let row = 0; row < rows; row += 1) {
    const [centerX, , centerZ] = centers[row] as [number, number, number]
    for (let k = 0; k <= around; k += 1) {
      const push = pushes[row * around + (k % around)] as number
      if (push <= 0) continue
      const offset = (row * columns + k) * 3
      const dx = (positions[offset] as number) - centerX
      const dz = (positions[offset + 2] as number) - centerZ
      const radius = Math.hypot(dx, dz) || 1
      positions[offset] = centerX + (dx / radius) * (radius + push)
      positions[offset + 2] = centerZ + (dz / radius) * (radius + push)
    }
  }
  const gridCount = rows * columns * 3
  const gridPositions = Array.from(positions.subarray(0, gridCount))
  const normals = mesh.normals.slice()
  normals.set(smoothNormalsVertically(gridNormals(gridPositions, rows, around), rows, columns))
  return { ...mesh, positions, normals }
}
