// Тесты слоёв: верхняя вещь не даёт нижней проступить сквозь ткань.
import { describe, expect, it } from 'vitest'
import type { SizeOption } from '../../types/analysis'
import { buildBodyModel } from '../avatar/sections'
import type { GarmentPart } from './garment'
import { LAYER_GAP_CM, buildOutfit, layerOver } from './layers'

const body = buildBodyModel({
  gender: 'female',
  heightCm: 168,
  weightKg: 60,
  chestCm: 90,
  waistCm: 70,
  hipsCm: 96,
})

/** Размер, у которого середина диапазона отстоит от мерок на shiftCm во всех зонах. */
function option(shiftCm: number): SizeOption {
  const zone = (name: 'chest' | 'waist' | 'hips', bodyCm: number) => ({
    zone: name,
    body_cm: bodyCm,
    size_min_cm: bodyCm + shiftCm - 3,
    size_max_cm: bodyCm + shiftCm + 3,
    excess_cm: 0,
    fit: 'good' as const,
  })
  return {
    size_label: 'M',
    size_order: 0,
    score: 0,
    zones: [zone('chest', 90), zone('waist', 70), zone('hips', 96)],
  }
}

/** Проверяет, что каждое кольцо детали outer на высоте деталей inner шире их с зазором. */
function expectEncloses(outer: GarmentPart, inner: GarmentPart) {
  const ys = inner.rings.map((ring) => ring.y)
  const [low, high] = [Math.min(...ys), Math.max(...ys)]
  const nearest = (y: number) =>
    inner.rings.reduce((best, ring) => (Math.abs(ring.y - y) < Math.abs(best.y - y) ? ring : best))
  const checked = outer.rings.filter((ring) => ring.y >= low && ring.y <= high)
  expect(checked.length).toBeGreaterThan(0)
  for (const ring of checked) {
    const innerRing = nearest(ring.y)
    if (Math.abs(innerRing.y - ring.y) > 0.01) continue
    expect(ring.a).toBeGreaterThanOrEqual(innerRing.a + LAYER_GAP_CM - 1e-6)
    expect(ring.b).toBeGreaterThanOrEqual(innerRing.b + LAYER_GAP_CM - 1e-6)
  }
}

describe('buildOutfit', () => {
  it('тесная футболка поверх свободных джинсов расширяется над ними', () => {
    const [jeans, tshirt] = buildOutfit(
      body,
      [
        { category: 'jeans', colorHex: '#1f3a5f', option: option(12) },
        { category: 'tshirt', colorHex: '#ffffff', option: option(-6) },
      ],
      'product',
    )
    expect(jeans).toBeDefined()
    expect(tshirt).toBeDefined()
    expectEncloses(tshirt![0]!, jeans![0]!)
  })

  it('рукава куртки надеваются поверх рукавов рубашки той же стороны', () => {
    const [shirt, jacket] = buildOutfit(
      body,
      [
        { category: 'shirt', colorHex: '#ffffff', option: option(10) },
        { category: 'jacket', colorHex: '#000000', option: option(-4) },
      ],
      'product',
    )
    const sleeves = (parts: GarmentPart[]) => parts.filter((part) => part.kind === 'sleeve')
    const [shirtLeft, shirtRight] = sleeves(shirt!)
    const [jacketLeft, jacketRight] = sleeves(jacket!)
    expectEncloses(jacketLeft!, shirtLeft!)
    expectEncloses(jacketRight!, shirtRight!)
    expectEncloses(jacket![0]!, shirt![0]!)
  })

  it('одна вещь не меняется', () => {
    const [single] = buildOutfit(
      body,
      [{ category: 'dress', colorHex: '#2e8b57', option: option(0) }],
      'fit',
    )
    expect(layerOver(single!, [])).toEqual(single)
  })
})
