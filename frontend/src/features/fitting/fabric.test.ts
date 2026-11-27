// Тесты процедурной фактуры ткани.
import { describe, expect, it } from 'vitest'
import { CATEGORY_FABRIC, FABRIC_LOOK, fabricBumpMap, fabricFor } from './fabric'

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

describe('fabricFor', () => {
  it('уточняет ткань по названию товара', () => {
    expect(fabricFor('jacket', 'Кожаная куртка-косуха')).toBe('leather')
    expect(fabricFor('jacket', 'Джинсовая куртка оверсайз')).toBe('denim')
    expect(fabricFor('skirt', 'Юбка из шерсти')).toBe('wool')
    expect(fabricFor('dress', 'Трикотажное платье')).toBe('knit')
  })

  it('без подсказки в названии берёт ткань категории', () => {
    expect(fabricFor('jeans', 'Прямые брюки')).toBe('denim')
    expect(fabricFor('shirt')).toBe('woven')
  })

  it('у всех тканей есть свойства материала и свой рисунок', () => {
    const kinds = ['knit', 'woven', 'denim', 'wool', 'leather'] as const
    const maps = kinds.map((kind) => fabricBumpMap(kind, 32).join())
    expect(new Set(maps).size).toBe(kinds.length)
    for (const kind of kinds) expect(FABRIC_LOOK[kind].roughness).toBeGreaterThan(0)
  })
})
