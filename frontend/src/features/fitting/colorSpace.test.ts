// Тесты перевода цвета товара в линейное пространство света.
import { describe, expect, it } from 'vitest'
import { srgbToLinear } from './colors'

describe('srgbToLinear', () => {
  it('сохраняет чёрный и белый и затемняет средние тона', () => {
    expect(srgbToLinear(0)).toBe(0)
    expect(srgbToLinear(1)).toBeCloseTo(1, 6)
    expect(srgbToLinear(0.5)).toBeCloseTo(0.214, 3)
  })
})
