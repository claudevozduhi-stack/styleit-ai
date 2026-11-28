// Тесты процедурной фактуры ткани.
import { describe, expect, it } from 'vitest'
import {
  CATEGORY_FABRIC,
  FABRIC_LOOK,
  ROUGHNESS_MAP_MEAN,
  fabricBumpMap,
  fabricFor,
  fabricMapUrls,
  roughnessFactor,
  textureRepeat,
  type FabricKind,
} from './fabric'

const KINDS: FabricKind[] = ['knit', 'woven', 'denim', 'wool', 'leather']

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

describe('карты-сканы тканей', () => {
  it('строит адреса карт с учётом базового пути сайта', () => {
    expect(fabricMapUrls('denim')).toEqual({
      normal: '/textures/fabric-denim-normal.jpg',
      rough: '/textures/fabric-denim-rough.jpg',
    })
    expect(fabricMapUrls('wool', '/app').normal).toBe('/app/textures/fabric-wool-normal.jpg')
  })

  it('файлы карт всех тканей лежат в public', () => {
    // Список файлов собирает Vite при сборке тестов; содержимое не загружается.
    const files = Object.keys(
      import.meta.glob('/public/textures/*.jpg', { query: '?url', import: 'default' }),
    )
    for (const kind of KINDS) {
      for (const url of Object.values(fabricMapUrls(kind))) {
        expect(files).toContain(`/public${url}`)
      }
    }
  })

  it('средняя матовость с картой равна заданной в свойствах ткани', () => {
    for (const kind of KINDS) {
      const look = FABRIC_LOOK[kind]
      expect(roughnessFactor(look) * ROUGHNESS_MAP_MEAN).toBeCloseTo(look.roughness, 6)
    }
  })

  it('повтор карты соответствует размеру куска ткани', () => {
    const look = { ...FABRIC_LOOK.knit, tileCm: 25 }
    expect(textureRepeat(look, 10)).toBeCloseTo(0.4, 6)
  })
})
