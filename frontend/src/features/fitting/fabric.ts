// Процедурные ткани: карта рельефа (bump map) и свойства материала генерируются кодом,
// без чужих текстур и фото.
import type { Category } from '../../types/catalog'

/** Ткань: трикотаж, гладкая ткань, деним (диагональная саржа), шерсть или кожа. */
export type FabricKind = 'knit' | 'woven' | 'denim' | 'wool' | 'leather'

/** Ткань по умолчанию для категории каталога, если название товара ничего не уточняет. */
export const CATEGORY_FABRIC: Record<Category, FabricKind> = {
  tshirt: 'knit',
  hoodie: 'knit',
  shirt: 'woven',
  jacket: 'woven',
  trousers: 'woven',
  skirt: 'woven',
  dress: 'woven',
  jeans: 'denim',
}

/**
 * Слова в названии товара, по которым понятна ткань (основа слова, без окончаний).
 * Порядок важен: «джинсовая куртка» — деним, «кожаная юбка» — кожа.
 */
const TITLE_FABRIC: Array<[RegExp, FabricKind]> = [
  [/кож|leather/i, 'leather'],
  [/джинс|деним|denim/i, 'denim'],
  [/шерст|твид|кашемир|драп|wool|tweed/i, 'wool'],
  [/трикотаж|вязан|джерси|knit|jersey/i, 'knit'],
]

/** Ткань вещи: по названию товара, иначе по категории. */
export function fabricFor(category: Category, title = ''): FabricKind {
  const match = TITLE_FABRIC.find(([pattern]) => pattern.test(title))
  return match ? match[1] : CATEGORY_FABRIC[category]
}

/** Свойства материала three.js (MeshPhysicalMaterial) для ткани. */
export interface FabricLook {
  roughness: number
  /** Мягкий отблеск ворса: у трикотажа и шерсти сильный, у кожи нет. */
  sheen: number
  sheenRoughness: number
  /** Лаковый слой: лёгкий блеск выделанной кожи. */
  clearcoat: number
  clearcoatRoughness: number
  /** Глубина рельефа переплетения. */
  bumpScale: number
  /** Сколько раз рисунок повторяется по окружности детали. */
  repeatAround: number
}

export const FABRIC_LOOK: Record<FabricKind, FabricLook> = {
  knit: {
    roughness: 0.9,
    sheen: 0.8,
    sheenRoughness: 0.5,
    clearcoat: 0,
    clearcoatRoughness: 1,
    bumpScale: 0.1,
    repeatAround: 12,
  },
  woven: {
    roughness: 0.8,
    sheen: 0.5,
    sheenRoughness: 0.6,
    clearcoat: 0,
    clearcoatRoughness: 1,
    bumpScale: 0.06,
    repeatAround: 14,
  },
  denim: {
    roughness: 0.95,
    sheen: 0.35,
    sheenRoughness: 0.8,
    clearcoat: 0,
    clearcoatRoughness: 1,
    bumpScale: 0.14,
    repeatAround: 10,
  },
  wool: {
    roughness: 1,
    sheen: 1,
    sheenRoughness: 0.35,
    clearcoat: 0,
    clearcoatRoughness: 1,
    bumpScale: 0.12,
    repeatAround: 8,
  },
  leather: {
    roughness: 0.65,
    sheen: 0,
    sheenRoughness: 1,
    clearcoat: 0.1,
    clearcoatRoughness: 0.6,
    bumpScale: 0.04,
    repeatAround: 6,
  },
}

/** Сторона квадратной карты рельефа в пикселях. */
export const FABRIC_TEXTURE_SIZE = 256

/** Детерминированный «шум» 0..1 по координатам пикселя: одинаковая картинка при каждой сборке. */
function hashNoise(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** Плавный шум: билинейная смесь значений hashNoise в узлах сетки шагом cell (бесшовно). */
function smoothNoise(x: number, y: number, cell: number, size: number): number {
  const cells = Math.max(Math.round(size / cell), 1)
  const gx = (x / size) * cells
  const gy = (y / size) * cells
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const fx = gx - x0
  const fy = gy - y0
  // Узлы берутся по модулю числа клеток, поэтому рисунок повторяется без шва.
  const at = (ix: number, iy: number) => hashNoise(ix % cells, iy % cells)
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx
  const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx
  return top + (bottom - top) * fy
}

/** Высота рельефа 0..1 в точке (x, y) для заданной ткани. */
function fabricHeight(kind: FabricKind, x: number, y: number, size: number): number {
  const wave = (count: number, coordinate: number) =>
    0.5 + 0.5 * Math.sin((2 * Math.PI * count * coordinate) / size)
  if (kind === 'knit') {
    // Петли трикотажа: столбики из «ёлочек», каждая петля — две наклонные половинки.
    const column = Math.floor((x * 32) / size)
    const local = ((x * 32) / size - column) * 2 - 1
    return wave(48, y + Math.abs(local) * (size / 96)) * (0.7 + 0.3 * wave(32, x))
  }
  if (kind === 'denim') {
    // Диагональ саржи, неровная («слабая») нить и лёгкие вертикальные полосы основы.
    const slub = smoothNoise(x, y * 0.25, 16, size)
    return 0.7 * wave(48, x + y) + 0.2 * slub + 0.1 * hashNoise(x, y)
  }
  if (kind === 'wool') {
    // Ворсистая поверхность: мягкий крупный шум и мелкие волоски.
    return 0.6 * smoothNoise(x, y, 8, size) + 0.4 * hashNoise(x, y)
  }
  if (kind === 'leather') {
    // Зерно кожи: мелкие поры и пологие складочки.
    const pores = smoothNoise(x, y, 4, size)
    return 0.5 * smoothNoise(x, y, 32, size) + 0.5 * pores * pores
  }
  // Полотняное переплетение: нити по очереди идут то сверху, то снизу.
  const cell = 4
  const over = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0
  return over ? wave(64, x) : wave(64, y)
}

/** Карта рельефа в формате RGBA (серый цвет), готовая для DataTexture. */
export function fabricBumpMap(kind: FabricKind, size = FABRIC_TEXTURE_SIZE): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = Math.round(Math.min(Math.max(fabricHeight(kind, x, y, size), 0), 1) * 255)
      const offset = (y * size + x) * 4
      data[offset] = value
      data[offset + 1] = value
      data[offset + 2] = value
      data[offset + 3] = 255
    }
  }
  return data
}
