// Сетка анатомического тела для сцены: только вершины тела (без центров суставов),
// сглаженные нормали и однотонный цвет манекена. Чистые функции без three.js.
import type { MeshData, Rgb } from './loft'
import type { HumanModel } from './humanModel'

/** Нормали вершин: сумма нормалей прилегающих треугольников (с весом по площади). */
export function vertexNormals(
  positions: Float32Array,
  indices: Uint32Array,
  vertexCount: number,
): Float32Array {
  const normals = new Float32Array(vertexCount * 3)
  for (let corner = 0; corner < indices.length; corner += 3) {
    const [a, b, c] = [0, 1, 2].map((offset) => (indices[corner + offset] as number) * 3) as [
      number,
      number,
      number,
    ]
    const ab = [0, 1, 2].map(
      (axis) => (positions[b + axis] as number) - (positions[a + axis] as number),
    )
    const ac = [0, 1, 2].map(
      (axis) => (positions[c + axis] as number) - (positions[a + axis] as number),
    )
    // Векторное произведение не нормируется: так большие треугольники весят больше.
    const cross = [
      (ab[1] as number) * (ac[2] as number) - (ab[2] as number) * (ac[1] as number),
      (ab[2] as number) * (ac[0] as number) - (ab[0] as number) * (ac[2] as number),
      (ab[0] as number) * (ac[1] as number) - (ab[1] as number) * (ac[0] as number),
    ]
    for (const vertex of [a, b, c]) {
      for (let axis = 0; axis < 3; axis += 1) {
        normals[vertex + axis] = (normals[vertex + axis] as number) + (cross[axis] as number)
      }
    }
  }
  for (let vertex = 0; vertex < vertexCount * 3; vertex += 3) {
    const length = Math.hypot(
      normals[vertex] as number,
      normals[vertex + 1] as number,
      normals[vertex + 2] as number,
    )
    if (length === 0) continue
    for (let axis = 0; axis < 3; axis += 1) {
      normals[vertex + axis] = (normals[vertex + axis] as number) / length
    }
  }
  return normals
}

/** Сетка подогнанного тела одним цветом; positions — вершины после fitHuman (в см). */
export function humanMeshData(model: HumanModel, positions: Float32Array, color: Rgb): MeshData {
  const count = model.vertexCount
  const body = positions.slice(0, count * 3)
  const indices = Uint32Array.from(model.indices)
  const colors = new Float32Array(count * 3)
  for (let vertex = 0; vertex < count; vertex += 1) colors.set(color, vertex * 3)
  return {
    positions: body,
    normals: vertexNormals(body, indices, count),
    colors,
    // Фактуры у манекена нет, развёртка нужна только для единого формата сетки.
    uvs: new Float32Array(count * 2),
    indices,
  }
}
