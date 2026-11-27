import { describe, expect, it } from 'vitest'
import {
  hexToHsl,
  hueDistance,
  isNeutral,
  outfitHarmony,
  pairHarmony,
  paletteCloseness,
} from './colorHarmony'

describe('hexToHsl', () => {
  it('переводит основные цвета', () => {
    expect(hexToHsl('#ff0000')).toEqual({ hue: 0, saturation: 1, lightness: 0.5 })
    expect(hexToHsl('#00ff00').hue).toBe(120)
    expect(hexToHsl('#808080').saturation).toBe(0)
  })

  it('отклоняет неверный цвет', () => {
    expect(() => hexToHsl('red')).toThrow(RangeError)
  })
})

describe('сочетаемость', () => {
  it('белый, чёрный и серый — нейтральные', () => {
    expect(['#ffffff', '#000000', '#7f7f7f'].every(isNeutral)).toBe(true)
    expect(isNeutral('#ff0000')).toBe(false)
  })

  it('разница тонов идёт по кругу', () => {
    expect(hueDistance(350, 10)).toBe(20)
  })

  it('нейтральный сочетается со всем, аналоговые и комплементарные — хорошо', () => {
    expect(pairHarmony('#ffffff', '#ff0000')).toBe(1)
    expect(pairHarmony('#ff0000', '#ff6600')).toBe(0.9)
    expect(pairHarmony('#ff0000', '#00ffff')).toBe(0.8)
    expect(pairHarmony('#ff0000', '#00ff00')).toBe(0.3)
  })

  it('образ из одной вещи сочетается идеально', () => {
    expect(outfitHarmony(['#ff0000'])).toBe(1)
  })
})

describe('paletteCloseness', () => {
  it('цвет из палитры — 1, далёкий — 0, пустая палитра — 0', () => {
    expect(paletteCloseness('#336699', ['#336699'])).toBe(1)
    expect(paletteCloseness('#000000', ['#ffffff'])).toBe(0)
    expect(paletteCloseness('#000000', [])).toBe(0)
  })
})
