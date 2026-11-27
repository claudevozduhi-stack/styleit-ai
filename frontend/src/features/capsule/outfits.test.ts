import { describe, expect, it } from 'vitest'
import type { Capsule, Confidence, LookItem } from '../../types/analysis'
import type { Category, Style } from '../../types/catalog'
import { capsule as baseCapsule } from '../../tests/fixtures'
import {
  bestOutfits,
  capsuleItems,
  combineOutfits,
  findOutfit,
  isValidOutfit,
  outfitId,
  outfitTitle,
  rankOutfits,
  scoreParts,
} from './outfits'

/** Вещь капсулы с нужной категорией, цветом и уверенностью размера. */
function item(
  id: number,
  category: Category,
  colorHex: string,
  confidence: Confidence = 'high',
  styles: Style[] = ['casual'],
): LookItem {
  const product = baseCapsule.looks[0]!.items[0]!.product
  return {
    recommended_size: 'M',
    size_confidence: confidence,
    size_note: '',
    product: {
      ...product,
      id,
      category,
      color_hex: colorHex,
      style_tags: styles,
      price_kzt: id * 1000,
    },
  }
}

const tshirt = item(1, 'tshirt', '#ffffff')
const jeans = item(2, 'jeans', '#1f3a5f')
const skirt = item(3, 'skirt', '#ff0000', 'low', ['evening'])
const jacket = item(4, 'jacket', '#000000')
const dress = item(5, 'dress', '#2e8b57')

const capsule: Capsule = {
  ...baseCapsule,
  looks: [
    { title: 'Город', explanation: 'Удобно.', items: [tshirt, jeans], total_kzt: 3000 },
    { title: 'Вечер', explanation: 'Ярко.', items: [skirt, tshirt, jacket], total_kzt: 8000 },
    { title: 'Лето', explanation: 'Легко.', items: [dress], total_kzt: 5000 },
  ],
}

describe('capsuleItems', () => {
  it('возвращает каждую вещь один раз', () => {
    expect(capsuleItems(capsule).map((entry) => entry.product.id)).toEqual([1, 2, 3, 4, 5])
  })
})

describe('isValidOutfit', () => {
  it('принимает верх + низ и платье, отклоняет два низа', () => {
    expect(isValidOutfit([tshirt, jeans, jacket])).toBe(true)
    expect(isValidOutfit([dress])).toBe(true)
    expect(isValidOutfit([jeans, skirt])).toBe(false)
    expect(isValidOutfit([dress, tshirt])).toBe(false)
  })
})

describe('combineOutfits', () => {
  it('собирает все сочетания с курткой и без', () => {
    const combos = combineOutfits(capsuleItems(capsule))
    // 1 верх × 2 низа + 1 платье = 3 основы, каждая с курткой и без.
    expect(combos).toHaveLength(6)
    expect(combos.every(isValidOutfit)).toBe(true)
  })
})

describe('outfitId и outfitTitle', () => {
  it('ID не зависит от порядка вещей', () => {
    expect(outfitId([jacket, tshirt, jeans])).toBe('1-2-4')
  })

  it('название перечисляет верх, низ и куртку', () => {
    expect(outfitTitle([jacket, jeans, tshirt])).toBe('Футболка, джинсы и куртка')
    expect(outfitTitle([dress])).toBe('Платье')
  })
})

describe('scoreParts', () => {
  it('низкая уверенность размера и спорные цвета снижают оценку', () => {
    const good = scoreParts([tshirt, jeans], [], false)
    const bad = scoreParts([item(6, 'tshirt', '#00ff00', 'low'), skirt], [], false)
    expect(good.size).toBe(1)
    expect(bad.size).toBe(0)
    expect(good.harmony).toBeGreaterThan(bad.harmony)
    expect(bad.style).toBe(0)
  })

  it('без палитры её часть нейтральна, с палитрой — по близости цвета', () => {
    expect(scoreParts([tshirt, jeans], [], false).palette).toBe(0.5)
    expect(scoreParts([tshirt, jeans], ['#ffffff', '#1f3a5f'], false).palette).toBe(1)
  })
})

describe('rankOutfits', () => {
  it('не повторяет образы стилиста и сортирует по оценке', () => {
    const ranked = rankOutfits(capsule, [])
    const ids = ranked.map((outfit) => outfit.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ranked).toHaveLength(6)
    const scores = ranked.map((outfit) => outfit.score)
    expect(scores).toEqual([...scores].sort((first, second) => second - first))
    const city = ranked.find((outfit) => outfit.id === '1-2')
    expect(city?.title).toBe('Город')
    expect(city?.fromStylist).toBe(true)
  })

  it('кладёт вещи по слоям: низ, верх, куртка', () => {
    const outfit = findOutfit(capsule, [], '1-3-4')
    expect(outfit?.items.map((entry) => entry.product.id)).toEqual([3, 1, 4])
  })

  it('неизвестный ID не находится', () => {
    expect(findOutfit(capsule, [], '1-3-5')).toBeUndefined()
  })

  it('bestOutfits ограничивает число образов', () => {
    expect(bestOutfits(capsule, [], 2)).toHaveLength(2)
  })
})
