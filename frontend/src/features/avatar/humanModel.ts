// Анатомическое тело из открытых данных MakeHuman (CC0): разбор файла модели, морфы и поза.
// Файл собирает скрипт tools/build_body_model.py; здесь только чистые функции без three.js.

/** Описание бинарного файла модели (body-v1.json). */
export interface HumanModelHeader {
  version: number
  deltaStepCm: number
  vertexCount: number
  joints: string[]
  partIds: Record<string, number>
  layout: Record<
    'positions' | 'indices' | 'parts' | 'armWeights',
    { offset: number; count: number }
  >
  targets: Record<string, number>
}

/** Морф: индексы вершин и смещения (x, y, z) в сантиметрах. */
export interface MorphTarget {
  indices: Uint16Array
  deltas: Float32Array
}

/** Разобранная модель: базовые вершины (тело + центры суставов), треугольники и морфы. */
export interface HumanModel {
  vertexCount: number
  /** Вершины тела, затем центры суставов — в сантиметрах. */
  basePositions: Float32Array
  indices: Uint16Array
  /** Номер части тела для каждой вершины (см. PART). */
  parts: Uint8Array
  /** Доля веса руки (0..1): насколько вершина поворачивается вместе с рукой. */
  armWeights: Float32Array
  joints: Map<string, number>
  targets: Map<string, MorphTarget>
}

/** Номера частей тела в файле модели (стороны — как в MakeHuman: «левая» лежит при x > 0). */
export const PART = {
  torso: 0,
  head: 1,
  armPositiveX: 2,
  armNegativeX: 3,
  legPositiveX: 4,
  legNegativeX: 5,
} as const

/** Разбирает файл модели. Ошибка формата — исключение, а не «пустое» тело. */
export function parseHumanModel(header: HumanModelHeader, buffer: ArrayBuffer): HumanModel {
  if (header.version !== 1) throw new RangeError(`Неизвестная версия модели: ${header.version}`)
  const { positions, indices, parts, armWeights } = header.layout
  const rawArm = new Uint8Array(buffer, armWeights.offset, armWeights.count)
  const targets = new Map<string, MorphTarget>()
  for (const [name, offset] of Object.entries(header.targets)) {
    targets.set(name, readTarget(buffer, offset, header.deltaStepCm))
  }
  return {
    vertexCount: header.vertexCount,
    basePositions: new Float32Array(buffer, positions.offset, positions.count * 3).slice(),
    indices: new Uint16Array(buffer, indices.offset, indices.count).slice(),
    parts: new Uint8Array(buffer, parts.offset, parts.count).slice(),
    armWeights: Float32Array.from(rawArm, (value) => value / 255),
    joints: new Map(header.joints.map((name, index) => [name, header.vertexCount + index])),
    targets,
  }
}

/** Читает один морф: uint32 число записей, uint16 индексы, int16 × 3 смещения в шагах. */
function readTarget(buffer: ArrayBuffer, offset: number, step: number): MorphTarget {
  const count = new DataView(buffer).getUint32(offset, true)
  const indicesOffset = offset + 4
  const deltasOffset = indicesOffset + count * 2
  const indices = new Uint16Array(buffer.slice(indicesOffset, deltasOffset))
  const raw = new Int16Array(buffer.slice(deltasOffset, deltasOffset + count * 6))
  return { indices, deltas: Float32Array.from(raw, (value) => value * step) }
}

/** Вершины с наложенными морфами: weights — вес каждого морфа по имени (0 — не влияет). */
export function applyMorphs(model: HumanModel, weights: Record<string, number>): Float32Array {
  const result = model.basePositions.slice()
  for (const [name, weight] of Object.entries(weights)) {
    if (weight === 0) continue
    const target = model.targets.get(name)
    if (!target) throw new RangeError(`В модели нет морфа ${name}`)
    addTarget(result, target, weight)
  }
  return result
}

/** Прибавляет морф с весом к вершинам (на месте). */
export function addTarget(positions: Float32Array, target: MorphTarget, weight: number): void {
  for (let entry = 0; entry < target.indices.length; entry += 1) {
    const vertex = (target.indices[entry] as number) * 3
    for (let axis = 0; axis < 3; axis += 1) {
      positions[vertex + axis] =
        (positions[vertex + axis] as number) + (target.deltas[entry * 3 + axis] as number) * weight
    }
  }
}

/** Координаты сустава по имени. */
export function jointPosition(
  model: HumanModel,
  positions: Float32Array,
  name: string,
): [number, number, number] {
  const index = model.joints.get(name)
  if (index === undefined) throw new RangeError(`В модели нет сустава ${name}`)
  return [
    positions[index * 3] as number,
    positions[index * 3 + 1] as number,
    positions[index * 3 + 2] as number,
  ]
}

/**
 * Опускает руки из A-позы MakeHuman ближе к телу, как у витринного манекена.
 * Поворот вокруг плечевого сустава в плоскости XY; вершины поворачиваются на долю
 * веса руки (линейный скиннинг), поэтому подмышка сгибается плавно.
 */
export function lowerArms(model: HumanModel, positions: Float32Array, angleRad: number): void {
  const pivots = {
    positive: jointPosition(model, positions, 'l-shoulder'),
    negative: jointPosition(model, positions, 'r-shoulder'),
  }
  const total = positions.length / 3
  for (let vertex = 0; vertex < total; vertex += 1) {
    const weight = armWeightOf(model, vertex)
    if (weight === 0) continue
    const x = positions[vertex * 3] as number
    const y = positions[vertex * 3 + 1] as number
    const pivot = x >= 0 ? pivots.positive : pivots.negative
    // Рука при x > 0 поворачивается по часовой стрелке (к телу), при x < 0 — против.
    const angle = (x >= 0 ? -angleRad : angleRad) * weight
    const dx = x - pivot[0]
    const dy = y - pivot[1]
    positions[vertex * 3] = pivot[0] + dx * Math.cos(angle) - dy * Math.sin(angle)
    positions[vertex * 3 + 1] = pivot[1] + dx * Math.sin(angle) + dy * Math.cos(angle)
  }
}

/** Суставы руки ниже плеча поворачиваются вместе с рукой целиком. */
const ARM_JOINTS = new Set(['l-elbow', 'r-elbow', 'l-hand', 'r-hand'])

/** Вес руки вершины; у суставов локтя и кисти — 1, у остальных суставов — 0. */
function armWeightOf(model: HumanModel, vertex: number): number {
  if (vertex < model.vertexCount) return model.armWeights[vertex] as number
  for (const name of ARM_JOINTS) {
    if (model.joints.get(name) === vertex) return 1
  }
  return 0
}

/** Суставы ноги ниже бедра поворачиваются вместе с ногой целиком. */
const LEG_JOINTS = new Set(['l-knee', 'r-knee', 'l-ankle', 'r-ankle'])
/** Доля длины ноги под тазобедренным суставом, на которой поворот плавно нарастает. */
const LEG_BLEND_SHARE = 0.2

/**
 * Сводит ноги из широкой стойки MakeHuman ближе, как у манекена: поворот вокруг
 * тазобедренного сустава в плоскости XY. Весов скелета для ног в файле нет, поэтому вес
 * вершины ноги плавно растёт от 0 у сустава до 1 на LEG_BLEND_SHARE длины ноги ниже —
 * так область шага не рвётся. Туловище не двигается.
 */
export function closeLegs(model: HumanModel, positions: Float32Array, angleRad: number): void {
  const hips = {
    positive: jointPosition(model, positions, 'l-upper-leg'),
    negative: jointPosition(model, positions, 'r-upper-leg'),
  }
  const ankleY = jointPosition(model, positions, 'l-ankle')[1]
  const band = (hips.positive[1] - ankleY) * LEG_BLEND_SHARE
  const total = positions.length / 3
  for (let vertex = 0; vertex < total; vertex += 1) {
    if (!isLegVertex(model, vertex)) continue
    const x = positions[vertex * 3] as number
    const y = positions[vertex * 3 + 1] as number
    const pivot = x >= 0 ? hips.positive : hips.negative
    const depth = Math.min(Math.max((pivot[1] - y) / band, 0), 1)
    const weight = depth * depth * (3 - 2 * depth)
    if (weight === 0) continue
    // Нога при x > 0 поворачивается по часовой стрелке (стопа к середине), при x < 0 — против.
    const angle = (x >= 0 ? -angleRad : angleRad) * weight
    const dx = x - pivot[0]
    const dy = y - pivot[1]
    positions[vertex * 3] = pivot[0] + dx * Math.cos(angle) - dy * Math.sin(angle)
    positions[vertex * 3 + 1] = pivot[1] + dx * Math.sin(angle) + dy * Math.cos(angle)
  }
}

/** Вершина ноги или сустав колена и стопы. */
function isLegVertex(model: HumanModel, vertex: number): boolean {
  if (vertex < model.vertexCount) {
    const part = model.parts[vertex]
    return part === PART.legPositiveX || part === PART.legNegativeX
  }
  for (const name of LEG_JOINTS) {
    if (model.joints.get(name) === vertex) return true
  }
  return false
}
