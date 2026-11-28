// Детали кроя: швы, строчка, обработанные края. Всё строится кодом как тонкие полоски,
// приподнятые над тканью на доли миллиметра, без текстур и чужих моделей.
import type { MeshData, Rgb } from '../avatar/loft'
import type { FabricKind } from './fabric'
import type { GarmentPart } from './garment'
import {
  columnPath,
  edgePath,
  length,
  mixPoints,
  normalize,
  rowPath,
  subtract,
  type SurfacePoint,
  type Vec3,
} from './surfacePath'

/** Как рисуется линия: толщина, пунктир (стежок и промежуток), подъём над тканью, цвет. */
export interface LineStyle {
  widthCm: number
  /** Длина стежка; Infinity — сплошная линия (сам шов). */
  dashCm: number
  gapCm: number
  liftCm: number
  color: (fabric: Rgb) => Rgb
}

/** Нитка строчки: заметно светлее тёмной ткани и темнее светлой — «в тон», но видна. */
export function threadTone(fabric: Rgb): Rgb {
  const luminance = 0.2126 * fabric[0] + 0.7152 * fabric[1] + 0.0722 * fabric[2]
  const target = luminance < 0.4 ? 1 : 0
  const share = luminance < 0.4 ? 0.28 : 0.22
  return [
    fabric[0] + (target - fabric[0]) * share,
    fabric[1] + (target - fabric[1]) * share,
    fabric[2] + (target - fabric[2]) * share,
  ]
}

/** Классическая медно-жёлтая нитка джинсов (sRGB). */
export const DENIM_THREAD: Rgb = [0.79, 0.55, 0.24]

/** Шов — тень в стыке двух деталей ткани: тот же цвет, заметно темнее. */
const SEAM_SHADE = 0.72

const SEAM_LINE: LineStyle = {
  widthCm: 0.12,
  dashCm: Infinity,
  gapCm: 0,
  liftCm: 0.03,
  color: (fabric) => [fabric[0] * SEAM_SHADE, fabric[1] * SEAM_SHADE, fabric[2] * SEAM_SHADE],
}

/** Строчка: стежки 3,5 мм через 1,5 мм. */
function stitchLine(denim: boolean): LineStyle {
  return {
    widthCm: denim ? 0.12 : 0.09,
    dashCm: 0.35,
    gapCm: 0.15,
    liftCm: 0.05,
    color: denim ? () => DENIM_THREAD : threadTone,
  }
}

/** Где на ткани идёт строчка, см от края или от шва. */
export interface TrimSpec {
  /** Подол, манжеты и низ брючин. */
  hemRows: number[]
  /** Горловина у верха вещи. */
  neckRows: number[]
  /** Отстрочка рядом с боковым швом (0 строчек — только сам шов). */
  seamRows: number[]
}

export const TRIM_SPECS: Record<FabricKind, TrimSpec> = {
  // Трикотаж: двойная плоская строчка распошивальной машины.
  knit: { hemRows: [1.3, 1.9], neckRows: [0.8], seamRows: [] },
  woven: { hemRows: [1], neckRows: [0.6], seamRows: [] },
  // Деним: двойная отстрочка на подоле и у швов.
  denim: { hemRows: [1, 1.6], neckRows: [0.6, 1.2], seamRows: [0.5, 0.9] },
  wool: { hemRows: [1.2], neckRows: [0.8], seamRows: [] },
  leather: { hemRows: [0.8], neckRows: [0.6], seamRows: [0.6] },
}

/** Пояс брюк и юбок: строчки по краю и шов, отделяющий пояс от вещи, см от верха. */
const WAISTBAND_ROWS = [0.6, 3.4]
const WAISTBAND_SEAM_CM = 4

/** Изменяемые массивы полосок одной вещи. */
interface TrimBuffer {
  positions: number[]
  normals: number[]
  colors: number[]
  indices: number[]
}

/** Поднимает точку над тканью по нормали. */
function lifted(point: SurfacePoint, liftCm: number): Vec3 {
  return [
    point.position[0] + point.normal[0] * liftCm,
    point.position[1] + point.normal[1] * liftCm,
    point.position[2] + point.normal[2] * liftCm,
  ]
}

/** Четырёхугольник-стежок от точки from до точки to шириной style.widthCm. */
function addQuad(buffer: TrimBuffer, from: SurfacePoint, to: SurfacePoint, style: LineStyle): void {
  const start = lifted(from, style.liftCm)
  const end = lifted(to, style.liftCm)
  const direction = normalize(subtract(end, start))
  const normal = normalize([
    from.normal[0] + to.normal[0],
    from.normal[1] + to.normal[1],
    from.normal[2] + to.normal[2],
  ])
  // Поперёк линии и по касательной к ткани: нормаль × направление.
  const side = normalize([
    normal[1] * direction[2] - normal[2] * direction[1],
    normal[2] * direction[0] - normal[0] * direction[2],
    normal[0] * direction[1] - normal[1] * direction[0],
  ])
  const half = style.widthCm / 2
  const base = buffer.positions.length / 3
  for (const [point, sign] of [
    [start, -1],
    [start, 1],
    [end, -1],
    [end, 1],
  ] as const) {
    buffer.positions.push(
      point[0] + side[0] * half * sign,
      point[1] + side[1] * half * sign,
      point[2] + side[2] * half * sign,
    )
    buffer.normals.push(...normal)
    buffer.colors.push(...style.color(sign < 0 ? from.color : to.color))
  }
  buffer.indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
}

/**
 * Прокладывает линию по точкам поверхности: сплошную (шов) или пунктиром (строчка).
 * Пунктир идёт по длине линии, поэтому стежки одинаковые и на широких, и на узких местах.
 */
export function addLine(buffer: TrimBuffer, path: SurfacePoint[], style: LineStyle): void {
  const period = style.dashCm + style.gapCm
  let phase = 0
  for (let index = 0; index + 1 < path.length; index += 1) {
    const from = path[index] as SurfacePoint
    const to = path[index + 1] as SurfacePoint
    const span = length(subtract(to.position, from.position))
    if (span <= 0) continue
    if (!Number.isFinite(style.dashCm)) {
      addQuad(buffer, from, to, style)
      continue
    }
    let walked = 0
    while (walked < span) {
      const inDash = phase < style.dashCm
      const left = (inDash ? style.dashCm : period) - phase
      const step = Math.min(left, span - walked)
      if (inDash) {
        addQuad(
          buffer,
          mixPoints(from, to, walked / span),
          mixPoints(from, to, (walked + step) / span),
          style,
        )
      }
      walked += step
      phase = (phase + step) % period
    }
  }
}

/** Боковые швы детали (по бокам, столбцы 0 и половина окружности) и отстрочка рядом. */
function addSideSeams(buffer: TrimBuffer, mesh: MeshData, spec: TrimSpec, denim: boolean): void {
  const layout = mesh.layout
  if (!layout) return
  for (const column of [0, (layout.columns - 1) / 2]) {
    addLine(buffer, columnPath(mesh, layout, column), SEAM_LINE)
    for (const offset of spec.seamRows)
      addLine(buffer, columnPath(mesh, layout, column, offset), stitchLine(denim))
  }
}

/** Строчки вдоль открытого края на заданных расстояниях от него. */
function addEdgeRows(
  buffer: TrimBuffer,
  mesh: MeshData,
  side: 'bottom' | 'top',
  rows: number[],
  denim: boolean,
): void {
  if (!mesh.layout) return
  for (const distance of rows)
    addLine(buffer, edgePath(mesh, mesh.layout, side, distance), stitchLine(denim))
}

/** Пояс брюк и юбки: шов пояса и строчки по нему. */
function addWaistband(buffer: TrimBuffer, mesh: MeshData, denim: boolean): void {
  if (!mesh.layout) return
  addLine(buffer, edgePath(mesh, mesh.layout, 'top', WAISTBAND_SEAM_CM), SEAM_LINE)
  addEdgeRows(buffer, mesh, 'top', WAISTBAND_ROWS, denim)
}

/** Детали одной части вещи по её виду: туловище, рукав или штанина. */
function addPartTrims(
  buffer: TrimBuffer,
  part: GarmentPart,
  mesh: MeshData,
  fabric: FabricKind,
  isBottomWear: boolean,
): void {
  const layout = mesh.layout
  if (!layout) return
  const spec = TRIM_SPECS[fabric]
  const denim = fabric === 'denim'
  if (layout.openBottom) addEdgeRows(buffer, mesh, 'bottom', spec.hemRows, denim)
  if (part.kind === 'sleeve') {
    // Пройма: рукав вшит в туловище там, где начинается окат над плечом.
    if (!layout.openTop) addLine(buffer, rowPath(mesh, layout, layout.lastRow), SEAM_LINE)
    return
  }
  addSideSeams(buffer, mesh, spec, denim)
  if (part.kind === 'torso' && layout.openTop) {
    if (isBottomWear) addWaistband(buffer, mesh, denim)
    else addEdgeRows(buffer, mesh, 'top', spec.neckRows, denim)
  }
}

/**
 * Швы и строчка одной вещи одной сеткой: parts и meshes — детали вещи и их сетки
 * в одном порядке. isBottomWear — брюки, джинсы и юбки (у них сверху пояс, а не горловина).
 */
export function garmentTrims(
  parts: GarmentPart[],
  meshes: MeshData[],
  fabric: FabricKind,
  isBottomWear: boolean,
): MeshData {
  const buffer: TrimBuffer = { positions: [], normals: [], colors: [], indices: [] }
  parts.forEach((part, index) => {
    const mesh = meshes[index]
    if (mesh) addPartTrims(buffer, part, mesh, fabric, isBottomWear)
  })
  return {
    positions: new Float32Array(buffer.positions),
    normals: new Float32Array(buffer.normals),
    colors: new Float32Array(buffer.colors),
    uvs: new Float32Array((buffer.positions.length / 3) * 2),
    indices: new Uint32Array(buffer.indices),
  }
}
