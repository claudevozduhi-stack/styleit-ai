// Оценка сочетаемости цветов вещей по HEX-коду: чистые функции без DOM и сети.
// Правила взяты из базовой теории цвета: нейтральные цвета сочетаются со всем,
// хроматические — если они близки по тону (аналоговые) или противоположны (комплементарные).

/** Цвет в модели HSL: тон 0..360, насыщенность и светлота 0..1. */
export interface Hsl {
  hue: number
  saturation: number
  lightness: number
}

/** Ниже этой насыщенности (или у очень тёмных и светлых) цвет считается нейтральным. */
const NEUTRAL_SATURATION = 0.18
const NEUTRAL_DARK = 0.12
const NEUTRAL_LIGHT = 0.92
/** Разница тонов, при которой цвета считаются аналоговыми, в градусах. */
const ANALOGOUS_HUE = 40
/** Окно комплементарных цветов вокруг 180°. */
const COMPLEMENTARY_WINDOW = 35
/** Расстояние в RGB, дальше которого цвет уже не считается близким к палитре. */
const PALETTE_RADIUS = 150

/** Разбирает «#rrggbb» в каналы 0..255. Неверная строка — ошибка. */
export function parseHex(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match?.[1]) throw new RangeError(`Неверный цвет: ${hex}`)
  const value = Number.parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** Переводит HEX-цвет в HSL. */
export function hexToHsl(hex: string): Hsl {
  const [red, green, blue] = parseHex(hex).map((channel) => channel / 255) as [
    number,
    number,
    number,
  ]
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  const delta = max - min
  if (delta === 0) return { hue: 0, saturation: 0, lightness }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue: number
  if (max === red) hue = ((green - blue) / delta) % 6
  else if (max === green) hue = (blue - red) / delta + 2
  else hue = (red - green) / delta + 4
  return { hue: (hue * 60 + 360) % 360, saturation, lightness }
}

/** Нейтральный цвет: белый, чёрный, серый, бежевый и другие малонасыщенные. */
export function isNeutral(hex: string): boolean {
  const { saturation, lightness } = hexToHsl(hex)
  return saturation < NEUTRAL_SATURATION || lightness < NEUTRAL_DARK || lightness > NEUTRAL_LIGHT
}

/** Кратчайшая разница тонов по цветовому кругу, 0..180°. */
export function hueDistance(first: number, second: number): number {
  const difference = Math.abs(first - second) % 360
  return difference > 180 ? 360 - difference : difference
}

/** Сочетаемость двух цветов 0..1: 1 — точно сочетаются, 0.3 — спорно. */
export function pairHarmony(firstHex: string, secondHex: string): number {
  if (isNeutral(firstHex) || isNeutral(secondHex)) return 1
  const distance = hueDistance(hexToHsl(firstHex).hue, hexToHsl(secondHex).hue)
  if (distance <= ANALOGOUS_HUE) return 0.9
  if (Math.abs(distance - 180) <= COMPLEMENTARY_WINDOW) return 0.8
  return 0.3
}

/** Средняя сочетаемость всех пар цветов образа; один цвет — идеально. */
export function outfitHarmony(colors: string[]): number {
  const scores: number[] = []
  colors.forEach((first, index) => {
    colors.slice(index + 1).forEach((second) => scores.push(pairHarmony(first, second)))
  })
  if (scores.length === 0) return 1
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

/** Близость цвета к палитре цветотипа 0..1: 1 — цвет есть в палитре. */
export function paletteCloseness(hex: string, palette: string[]): number {
  if (palette.length === 0) return 0
  const color = parseHex(hex)
  const nearest = Math.min(
    ...palette.map((paletteHex) => {
      const other = parseHex(paletteHex)
      return Math.hypot(color[0] - other[0], color[1] - other[1], color[2] - other[2])
    }),
  )
  return Math.max(0, 1 - nearest / PALETTE_RADIUS)
}
