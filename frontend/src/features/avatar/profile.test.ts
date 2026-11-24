// Тесты формы сечения: выпуклости и складки не меняют обхват тела и не уходят внутрь.
import { describe, expect, it } from 'vitest'
import { ramanujanPerimeter } from './ellipse'
import { NO_FEATURES, featureScale, outlineLength, ringOutline, type OutlineInput } from './profile'

const base: OutlineInput = {
  a: 16,
  b: 12,
  centerX: 0,
  centerZ: 0,
  features: NO_FEATURES,
  foldDepth: 0,
  foldCount: 0,
  foldPhase: 0,
}

describe('ringOutline', () => {
  it('без выпуклостей и складок даёт эллипс нужного обхвата', () => {
    const outline = ringOutline(base, 400)
    expect(outlineLength(outline)).toBeCloseTo(ramanujanPerimeter(16, 12), 1)
  })

  it('грудь выступает вперёд, а обхват остаётся прежним', () => {
    const features = { ...NO_FEATURES, bust: 0.2 }
    const outline = ringOutline({ ...base, features }, 400)
    expect(outlineLength(outline)).toBeCloseTo(ramanujanPerimeter(16, 12), 1)
    const frontDepth = Math.max(...outline.map(([, z]) => z))
    const backDepth = -Math.min(...outline.map(([, z]) => z))
    expect(frontDepth).toBeGreaterThan(backDepth)
  })

  it('складки откладываются только наружу от гладкого контура', () => {
    const smooth = ringOutline(base, 120)
    const folded = ringOutline({ ...base, foldDepth: 1.2, foldCount: 10 }, 120)
    folded.forEach(([x, z], k) => {
      const [sx, sz] = smooth[k] as [number, number]
      expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(Math.hypot(sx, sz) - 1e-9)
    })
    expect(outlineLength(folded)).toBeGreaterThan(outlineLength(smooth))
  })

  it('учитывает смещение центра', () => {
    const outline = ringOutline({ ...base, centerX: 5, centerZ: -3 }, 64)
    const meanX = outline.reduce((sum, [x]) => sum + x, 0) / outline.length
    const meanZ = outline.reduce((sum, [, z]) => sum + z, 0) / outline.length
    expect(meanX).toBeCloseTo(5, 5)
    expect(meanZ).toBeCloseTo(-3, 5)
  })
})

describe('featureScale', () => {
  it('ягодицы увеличивают радиус сзади и почти не трогают перёд', () => {
    const features = { ...NO_FEATURES, buttocks: 0.2 }
    expect(featureScale(features, -Math.PI / 2 - 0.45)).toBeGreaterThan(1.15)
    expect(featureScale(features, Math.PI / 2)).toBeCloseTo(1, 3)
  })
})
