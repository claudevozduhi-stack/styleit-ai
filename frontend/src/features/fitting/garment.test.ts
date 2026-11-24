// Тесты одежды: запас из размерной сетки, раскраска посадки и крой по категориям.
import { describe, expect, it } from 'vitest'
import type { SizeOption } from '../../types/analysis'
import type { Measurements } from '../../types/body'
import { ellipseForGirth, ramanujanPerimeter } from '../avatar/ellipse'
import type { LoftRing } from '../avatar/loft'
import { buildBodyModel, sectionAt } from '../avatar/sections'
import { FIT_HEX, hexToRgb } from './colors'
import { MIN_CLEARANCE_CM, buildGarment, easeAt, foldDepthFor, zoneEases } from './garment'
import { bodyMeshes, garmentMeshes } from './scene'

const measurements: Measurements = {
  gender: 'female',
  heightCm: 168,
  weightKg: 60,
  chestCm: 90,
  waistCm: 70,
  hipsCm: 96,
}
const body = buildBodyModel(measurements)

/** Вариант размера с одинаковым смещением диапазона от мерок во всех зонах. */
function option(
  label: string,
  shiftCm: number,
  fit: SizeOption['zones'][number]['fit'],
): SizeOption {
  const zone = (name: 'chest' | 'waist' | 'hips', bodyCm: number) => ({
    zone: name,
    body_cm: bodyCm,
    size_min_cm: bodyCm + shiftCm - 3,
    size_max_cm: bodyCm + shiftCm + 3,
    excess_cm: 0,
    fit,
  })
  return {
    size_label: label,
    size_order: 0,
    score: 0,
    zones: [zone('chest', 90), zone('waist', 70), zone('hips', 96)],
  }
}

/** Обхват кольца по его полуосям. */
const girthOf = (ring: LoftRing) => ramanujanPerimeter(ring.a, ring.b)

/** Кольцо вещи, ближайшее к высоте y. */
function ringNear(rings: LoftRing[], y: number): LoftRing {
  return rings.reduce((best, ring) => (Math.abs(ring.y - y) < Math.abs(best.y - y) ? ring : best))
}

describe('zoneEases и easeAt', () => {
  it('запас = середина размера − мерка + запас фасона', () => {
    const eases = zoneEases(option('M', 4, 'good'), body.landmarks, 6)
    expect(eases.map((e) => e.zone)).toEqual(['hips', 'waist', 'chest'])
    expect(eases.every((e) => e.easeCm === 10)).toBe(true)
  })

  it('между зонами запас меняется линейно', () => {
    const eases = [
      { zone: 'waist' as const, y: 100, easeCm: 2, fit: 'good' as const },
      { zone: 'chest' as const, y: 120, easeCm: 6, fit: 'good' as const },
    ]
    expect(easeAt(eases, 110, 0)).toBe(4)
    expect(easeAt(eases, 90, 0)).toBe(2)
    expect(easeAt([], 90, 5)).toBe(5)
  })
})

describe('buildGarment', () => {
  const chestY = body.landmarks.chestY

  it('больший размер сидит свободнее меньшего', () => {
    const small = buildGarment(body, 'tshirt', option('S', -4, 'tight'), '#ffffff', 'product')
    const large = buildGarment(body, 'tshirt', option('L', 6, 'loose'), '#ffffff', 'product')
    const smallGirth = girthOf(ringNear(small[0]!.rings, chestY))
    const largeGirth = girthOf(ringNear(large[0]!.rings, chestY))
    expect(largeGirth - smallGirth).toBeCloseTo(10, 6)
  })

  it('тесный размер не уходит внутрь тела', () => {
    const garment = buildGarment(body, 'tshirt', option('XS', -20, 'tight'), '#ffffff', 'product')
    expect(girthOf(ringNear(garment[0]!.rings, chestY))).toBeCloseTo(90 + MIN_CLEARANCE_CM, 6)
  })

  it('в режиме посадки зона груди окрашена цветом посадки', () => {
    const garment = buildGarment(body, 'tshirt', option('S', -4, 'tight'), '#000000', 'fit')
    const color = ringNear(garment[0]!.rings, chestY).color
    hexToRgb(FIT_HEX.tight).forEach((channel, index) => {
      expect(color[index]).toBeCloseTo(channel, 1)
    })
  })

  it('в режиме товара всё окрашено цветом товара', () => {
    const garment = buildGarment(body, 'jacket', option('M', 0, 'good'), '#336699', 'product')
    const expected = hexToRgb('#336699')
    expect(
      garment.flatMap((part) => part.rings).every((r) => r.color.join() === expected.join()),
    ).toBe(true)
  })

  it('крой зависит от категории', () => {
    const fitOption = option('M', 0, 'good')
    expect(buildGarment(body, 'tshirt', fitOption, '#ffffff', 'product')).toHaveLength(3)
    expect(buildGarment(body, 'trousers', fitOption, '#ffffff', 'product')).toHaveLength(3)
    const skirt = buildGarment(body, 'skirt', fitOption, '#ffffff', 'product')
    expect(skirt).toHaveLength(1)
    expect(skirt[0]!.rings[0]!.y).toBeLessThan(body.landmarks.crotchY)
  })

  it('кольца вещи совпадают с эллипсом своего обхвата', () => {
    const ring = buildGarment(body, 'dress', option('M', 0, 'good'), '#ffffff', 'product')[0]!
      .rings[0]!
    const expected = ellipseForGirth(girthOf(ring), 0.8)
    expect(ring.a).toBeCloseTo(expected.a, 6)
  })
})

describe('hexToRgb', () => {
  it('переводит HEX в доли и отклоняет неверную строку', () => {
    expect(hexToRgb('#ff0000')).toEqual([1, 0, 0])
    expect(() => hexToRgb('red')).toThrow(RangeError)
  })
})

describe('scene meshes', () => {
  it('строит пять частей манекена и столько же сеток, сколько деталей у вещи', () => {
    expect(bodyMeshes(body)).toHaveLength(5)
    const parts = buildGarment(body, 'jeans', option('M', 0, 'good'), '#223344', 'fit')
    expect(garmentMeshes(parts)).toHaveLength(parts.length)
  })
})

describe('реалистичность ткани', () => {
  it('складок нет в обтяжку и больше у свободной вещи', () => {
    expect(foldDepthFor(1)).toBe(0)
    expect(foldDepthFor(12)).toBeGreaterThan(foldDepthFor(6))
    expect(foldDepthFor(100)).toBeLessThanOrEqual(1.5)
  })

  it('ни одна деталь туловища не уже тела на той же высоте', () => {
    const categories = [
      'tshirt',
      'shirt',
      'hoodie',
      'jacket',
      'trousers',
      'jeans',
      'skirt',
      'dress',
    ] as const
    for (const category of categories) {
      const torso = buildGarment(
        body,
        category,
        option('XS', -20, 'tight'),
        '#ffffff',
        'product',
      )[0]!
      for (const ring of torso.rings) {
        const bodyGirth = sectionAt(body.parts.torso.sections, ring.y).girth
        expect(girthOf(ring)).toBeGreaterThanOrEqual(bodyGirth)
      }
    }
  })
})
