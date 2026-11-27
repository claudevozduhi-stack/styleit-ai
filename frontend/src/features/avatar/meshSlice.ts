// Горизонтальные срезы сетки тела: контур сечения, выпуклая оболочка и обхват «как сантиметром».
// Сантиметровая лента огибает тело по выпуклой оболочке сечения, поэтому обхват — это её периметр.

/** Точка сечения в плоскости XZ. */
export type Point2 = [number, number]

/** Треугольники одной группы частей тела: индексы вершин и пределы по высоте для отбора. */
export interface TriangleSet {
  indices: Uint32Array
  minY: Float32Array
  maxY: Float32Array
}

/** Отбирает треугольники, у которых хотя бы одна вершина принадлежит нужным частям. */
export function trianglesOf(
  positions: Float32Array,
  indices: Uint16Array,
  parts: Uint8Array,
  wanted: ReadonlySet<number>,
): TriangleSet {
  const picked: number[] = []
  for (let corner = 0; corner < indices.length; corner += 3) {
    const triangle = [indices[corner], indices[corner + 1], indices[corner + 2]] as number[]
    if (triangle.some((vertex) => wanted.has(parts[vertex] as number))) picked.push(...triangle)
  }
  const count = picked.length / 3
  const minY = new Float32Array(count)
  const maxY = new Float32Array(count)
  for (let triangle = 0; triangle < count; triangle += 1) {
    const ys = [0, 1, 2].map(
      (corner) => positions[(picked[triangle * 3 + corner] as number) * 3 + 1],
    )
    minY[triangle] = Math.min(...(ys as number[]))
    maxY[triangle] = Math.max(...(ys as number[]))
  }
  return { indices: Uint32Array.from(picked), minY, maxY }
}

/** Точки пересечения рёбер треугольников с плоскостью y = const. */
export function slicePoints(positions: Float32Array, set: TriangleSet, y: number): Point2[] {
  const points: Point2[] = []
  for (let triangle = 0; triangle < set.minY.length; triangle += 1) {
    if (y < (set.minY[triangle] as number) || y > (set.maxY[triangle] as number)) continue
    for (let edge = 0; edge < 3; edge += 1) {
      const a = (set.indices[triangle * 3 + edge] as number) * 3
      const b = (set.indices[triangle * 3 + ((edge + 1) % 3)] as number) * 3
      const ya = positions[a + 1] as number
      const yb = positions[b + 1] as number
      if ((ya - y) * (yb - y) > 0 || ya === yb) continue
      const t = (y - ya) / (yb - ya)
      points.push([
        (positions[a] as number) + ((positions[b] as number) - (positions[a] as number)) * t,
        (positions[a + 2] as number) +
          ((positions[b + 2] as number) - (positions[a + 2] as number)) * t,
      ])
    }
  }
  return points
}

/** Выпуклая оболочка точек (монотонная цепь Эндрю), обход против часовой стрелки. */
export function convexHull(points: Point2[]): Point2[] {
  const sorted = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1])
  if (sorted.length < 3) return sorted
  const cross = (o: Point2, a: Point2, b: Point2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const build = (list: Point2[]) => {
    const chain: Point2[] = []
    for (const point of list) {
      while (
        chain.length >= 2 &&
        cross(chain[chain.length - 2] as Point2, chain[chain.length - 1] as Point2, point) <= 0
      ) {
        chain.pop()
      }
      chain.push(point)
    }
    chain.pop()
    return chain
  }
  return [...build(sorted), ...build([...sorted].reverse())]
}

/** Периметр замкнутого многоугольника. */
export function perimeter(polygon: Point2[]): number {
  let length = 0
  polygon.forEach((point, index) => {
    const next = polygon[(index + 1) % polygon.length] as Point2
    length += Math.hypot(next[0] - point[0], next[1] - point[1])
  })
  return length
}

/** Обхват «сантиметром» на высоте y: периметр выпуклой оболочки сечения (0 — сечения нет). */
export function girthAt(positions: Float32Array, set: TriangleSet, y: number): number {
  const hull = convexHull(slicePoints(positions, set, y))
  return hull.length >= 3 ? perimeter(hull) : 0
}

/** Центр прямоугольника, описанного вокруг многоугольника. */
export function boundsCenter(polygon: Point2[]): Point2 {
  const xs = polygon.map((point) => point[0])
  const zs = polygon.map((point) => point[1])
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2]
}

/**
 * Расстояния от центра до выпуклого контура по `segments` направлениям (начиная с +X,
 * против часовой стрелки к +Z). Так сечение тела превращается в кольцо для лофта одежды.
 */
export function radialProfile(hull: Point2[], center: Point2, segments: number): number[] {
  const radii: number[] = []
  for (let k = 0; k < segments; k += 1) {
    const angle = (2 * Math.PI * k) / segments
    const direction: Point2 = [Math.cos(angle), Math.sin(angle)]
    let best = 0
    hull.forEach((start, index) => {
      const end = hull[(index + 1) % hull.length] as Point2
      const hit = rayHit(center, direction, start, end)
      if (hit !== null && hit > best) best = hit
    })
    radii.push(best)
  }
  return radii
}

/** Расстояние вдоль луча до пересечения с отрезком или null, если пересечения нет. */
function rayHit(origin: Point2, direction: Point2, start: Point2, end: Point2): number | null {
  const edge: Point2 = [end[0] - start[0], end[1] - start[1]]
  const denominator = direction[0] * edge[1] - direction[1] * edge[0]
  if (Math.abs(denominator) < 1e-9) return null
  const offset: Point2 = [start[0] - origin[0], start[1] - origin[1]]
  const distance = (offset[0] * edge[1] - offset[1] * edge[0]) / denominator
  const along = (offset[0] * direction[1] - offset[1] * direction[0]) / denominator
  return distance >= 0 && along >= -1e-9 && along <= 1 + 1e-9 ? distance : null
}
