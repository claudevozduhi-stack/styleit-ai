// Тесты процедурной фактуры ткани.
import { describe, expect, it } from 'vitest'
import { CATEGORY_FABRIC, fabricBumpMap } from './fabric'

describe('fabricBumpMap', () => {
  it('даёт RGBA-карту нужного размера, одинаковую при каждом вызове', () => {
    const map = fabricBumpMap('denim', 16)
    expect(map).toHaveLength(16 * 16 * 4)
    expect(fabricBumpMap('denim', 16)).toEqual(map)
    expect(map[3]).toBe(255)
  })

  it('у разных переплетений разный рисунок', () => {
    expect(fabricBumpMap('knit', 32)).not.toEqual(fabricBumpMap('woven', 32))
    expect(fabricBumpMap('woven', 32)).not.toEqual(fabricBumpMap('denim', 32))
  })

  it('джинсы — деним, футболки — трикотаж', () => {
    expect(CATEGORY_FABRIC.jeans).toBe('denim')
    expect(CATEGORY_FABRIC.tshirt).toBe('knit')
  })
})
