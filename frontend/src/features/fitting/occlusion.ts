// Мягкое затенение одежды (ambient occlusion), посчитанное кодом в вершинах сетки:
// ткань темнеет там, куда меньше попадает рассеянный свет — под руками, между ног,
// у тела и в глубине складок. Без текстур и без запекания в редакторе.
import type { MeshData } from '../avatar/loft'
import type { BodyModel } from '../avatar/sections'
import { normalize, type Vec3 } from './surfacePath'

/** Заслоняющее тело: шар на месте сечения манекена. */
export interface Occluder {
  center: Vec3
  radius: number
  /** Вес шара: соседние сечения перекрываются, вместе они — «колбаса», а не цепочка шаров. */
  weight: number
}

/** Насколько сильно затенение от частей тела и до какой доли оно может затемнить ткань. */
const OCCLUSION_STRENGTH = 0.8
const OCCLUSION_MAX = 0.5
/** Затемнение дна складки и глубина впадины (см), при которой оно полное. */
const CAVITY_STRENGTH = 0.18
const CAVITY_FULL_CM = 0.8

/** Шары-сечения всех частей манекена: по ним считается, что заслоняет свет у ткани. */
export function bodyOccluders(body: BodyModel): Occluder[] {
  const occluders: Occluder[] = []
  for (const part of Object.values(body.parts)) {
    part.sections.forEach((section, index) => {
      const radius = section.girth / (2 * Math.PI)
      const next = part.sections[index + 1] ?? part.sections[index - 1]
      const spacing = next ? Math.abs(next.y - section.y) : 2 * radius
      occluders.push({
        center: [section.centerX, section.y, section.centerZ ?? 0],
        radius,
        weight: Math.min(spacing / (2 * radius), 1),
      })
    })
  }
  return occluders
}

/**
 * Затенение точки одним шаром (аналитическая формула для сферы): чем шар ближе и чем
 * прямее он стоит «перед» нормалью ткани, тем больше неба он закрывает.
 */
export function sphereOcclusion(point: Vec3, normal: Vec3, occluder: Occluder): number {
  const toCenter: Vec3 = [
    occluder.center[0] - point[0],
    occluder.center[1] - point[1],
    occluder.center[2] - point[2],
  ]
  const distanceSquared = toCenter[0] ** 2 + toCenter[1] ** 2 + toCenter[2] ** 2
  if (distanceSquared === 0) return 0
  const direction = normalize(toCenter)
  const facing = normal[0] * direction[0] + normal[1] * direction[1] + normal[2] * direction[2]
  if (facing <= 0) return 0
  return Math.min((occluder.radius * occluder.radius) / distanceSquared, 1) * facing
}

/** Доля рассеянного света, которую закрывают части тела, для точки ткани (0..OCCLUSION_MAX). */
export function occlusionAt(point: Vec3, normal: Vec3, occluders: Occluder[]): number {
  let total = 0
  for (const occluder of occluders)
    total += sphereOcclusion(point, normal, occluder) * occluder.weight
  return Math.min(total * OCCLUSION_STRENGTH, OCCLUSION_MAX)
}

/** Читает три числа массива по номеру вершины. */
function vectorAt(array: Float32Array, index: number): Vec3 {
  return [
    array[index * 3] as number,
    array[index * 3 + 1] as number,
    array[index * 3 + 2] as number,
  ]
}

/**
 * Глубина впадины в вершине решётки: насколько вершина ниже (по своей нормали) середины
 * между соседями по кольцу. У дна складки больше нуля, у гребня — ноль.
 */
function cavityAt(mesh: MeshData, index: number, columns: number): number {
  const column = index % columns
  const rowStart = index - column
  const around = columns - 1
  const behind = rowStart + ((column - 1 + around) % around)
  const ahead = rowStart + ((column + 1) % around)
  const point = vectorAt(mesh.positions, index)
  const normal = vectorAt(mesh.normals, index)
  const before = vectorAt(mesh.positions, behind)
  const after = vectorAt(mesh.positions, ahead)
  const depth =
    ((before[0] + after[0]) / 2 - point[0]) * normal[0] +
    ((before[1] + after[1]) / 2 - point[1]) * normal[1] +
    ((before[2] + after[2]) / 2 - point[2]) * normal[2]
  return Math.min(Math.max(depth / CAVITY_FULL_CM, 0), 1)
}

/**
 * Сетка детали с затенением в цветах вершин: от частей тела и в глубине складок.
 * Вершины крышек (вне решётки лофта) затеняются только от тела.
 */
export function shadeGarmentMesh(mesh: MeshData, occluders: Occluder[]): MeshData {
  const colors = mesh.colors.slice()
  const gridVertices = mesh.layout ? mesh.layout.rows * mesh.layout.columns : 0
  const count = mesh.positions.length / 3
  for (let index = 0; index < count; index += 1) {
    const occlusion = occlusionAt(
      vectorAt(mesh.positions, index),
      vectorAt(mesh.normals, index),
      occluders,
    )
    const cavity =
      mesh.layout && index < gridVertices ? cavityAt(mesh, index, mesh.layout.columns) : 0
    const light = (1 - occlusion) * (1 - CAVITY_STRENGTH * cavity)
    for (let channel = 0; channel < 3; channel += 1) colors[index * 3 + channel] *= light
  }
  return { ...mesh, colors }
}
