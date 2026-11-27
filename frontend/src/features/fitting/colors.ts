// Цвета посадки и перевод HEX-цвета товара в доли RGB для вершин сетки.
import type { Fit } from '../../types/analysis'
import type { Rgb } from '../avatar/loft'

/** HEX-цвета посадки; совпадают с темой интерфейса (src/index.css). */
export const FIT_HEX: Record<Fit, string> = {
  loose: '#3b82f6',
  good: '#22c55e',
  tight: '#ef4444',
}

/** Подписи посадки для легенды и таблицы зон. */
export const FIT_LABELS: Record<Fit, string> = {
  loose: 'свободно',
  good: 'в самый раз',
  tight: 'тесно',
}

/** Цвет манекена: светлый нейтральный, без черт лица и кожи конкретного человека. */
export const MANNEQUIN_HEX = '#e7e2dc'

/** Переводит «#rrggbb» в доли 0..1. Неверная строка — ошибка, а не тихий чёрный цвет. */
export function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match?.[1]) throw new RangeError(`Неверный цвет: ${hex}`)
  const value = Number.parseInt(match[1], 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

/**
 * Переводит долю канала из sRGB (как в HEX-цвете товара) в линейную яркость, в которой
 * считает свет three.js. Без перевода тёмные цвета на экране выходят блёклыми.
 */
export function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}
