// Процедурная фактура ткани: карта рельефа (bump map) генерируется кодом, без чужих текстур.
import type { Category } from '../../types/catalog'

/** Тип переплетения: трикотаж, гладкая ткань или деним (диагональная саржа). */
export type FabricKind = 'knit' | 'woven' | 'denim'

/** Какая фактура у какой категории каталога. */
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

/** Сторона квадратной карты рельефа в пикселях. */
export const FABRIC_TEXTURE_SIZE = 128

/** Детерминированный «шум» 0..1 по координатам пикселя: одинаковая картинка при каждой сборке. */
function hashNoise(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** Высота рельефа 0..1 в точке (x, y) для заданного переплетения. */
function fabricHeight(kind: FabricKind, x: number, y: number, size: number): number {
  const wave = (count: number, coordinate: number) =>
    0.5 + 0.5 * Math.sin((2 * Math.PI * count * coordinate) / size)
  if (kind === 'knit') {
    // Вертикальные петельные столбики, каждый ряд петель чуть смещён.
    return wave(32, x) * (0.65 + 0.35 * wave(48, y))
  }
  if (kind === 'denim') {
    // Диагональ саржи и лёгкая неровность нити.
    return 0.85 * wave(24, x + y) + 0.15 * hashNoise(x, y)
  }
  // Полотняное переплетение: нити по очереди идут то сверху, то снизу.
  const cell = 4
  const over = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0
  return over ? wave(32, x) : wave(32, y)
}

/** Карта рельефа в формате RGBA (серый цвет), готовая для DataTexture. */
export function fabricBumpMap(kind: FabricKind, size = FABRIC_TEXTURE_SIZE): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = Math.round(fabricHeight(kind, x, y, size) * 255)
      const offset = (y * size + x) * 4
      data[offset] = value
      data[offset + 1] = value
      data[offset + 2] = value
      data[offset + 3] = 255
    }
  }
  return data
}
