// Тесты одежды на теле по скану: длинная куртка поверх брюк и юбка поверх ног.
import { describe, expect, it } from 'vitest'
import { testHumanModel as model } from '../../tests/humanModelFixture'
import type { SizeOption } from '../../types/analysis'
import { fitHuman } from '../avatar/humanFit'
import { humanBodyModel } from '../avatar/humanSections'
import type { LoftRing } from '../avatar/loft'
import type { Point2 } from '../avatar/meshSlice'
import { NO_FEATURES } from '../avatar/profile'
import { ringPoints } from './enclose'
import { buildGarment } from './garment'
import { buildOutfit } from './layers'

const body = humanBodyModel(
  model,
  fitHuman(model, {
    gender: 'female',
    heightCm: 168,
    weightKg: 60,
    chestCm: 92,
    waistCm: 72,
    hipsCm: 98,
  }),
)

const zone = (name: 'chest' | 'waist' | 'hips', bodyCm: number) => ({
  zone: name,
  body_cm: bodyCm,
  size_min_cm: bodyCm + 1,
  size_max_cm: bodyCm + 7,
  excess_cm: 0,
  fit: 'good' as const,
})
const option: SizeOption = {
  size_label: 'M',
  size_order: 0,
  score: 0,
  zones: [zone('chest', 92), zone('waist', 72), zone('hips', 98)],
}

/** Лежит ли точка внутри выпуклого контура кольца (с допуском в см). */
function inside(ring: LoftRing, point: Point2, toleranceCm: number): boolean {
  const outline = ringPoints(ring, toleranceCm)
  return outline.every((start, index) => {
    const end = outline[(index + 1) % outline.length] as Point2
    const cross =
      (end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0])
    return cross >= 0
  })
}

/** Выпуклый ли контур кольца: на нём нет впадин и бугров. */
function isConvex(ring: LoftRing): boolean {
  const outline = ringPoints(ring, 0)
  return outline.every((point, index) => {
    const next = outline[(index + 1) % outline.length] as Point2
    const after = outline[(index + 2) % outline.length] as Point2
    const cross =
      (next[0] - point[0]) * (after[1] - next[1]) - (next[1] - point[1]) * (after[0] - next[0])
    return cross > -0.05
  })
}

describe('одежда на теле по скану', () => {
  it('низ длинной куртки поверх брюк ровный и закрывает обе штанины', () => {
    const [trousers, , jacket] = buildOutfit(
      body,
      [
        { category: 'trousers', colorHex: '#333333', option },
        { category: 'shirt', colorHex: '#ffffff', option },
        { category: 'jacket', colorHex: '#556b2f', option },
      ],
      'product',
    )
    const jacketTorso = jacket?.find((part) => part.kind === 'torso')
    const hem = jacketTorso?.rings.reduce((low, ring) => (ring.y < low.y ? ring : low))
    expect(hem).toBeDefined()
    expect(isConvex(hem as LoftRing)).toBe(true)
    const legs = (trousers ?? []).filter((part) => part.kind === 'leg')
    expect(legs).toHaveLength(2)
    for (const leg of legs) {
      const ring = leg.rings.reduce((best, each) =>
        Math.abs(each.y - (hem as LoftRing).y) < Math.abs(best.y - (hem as LoftRing).y)
          ? each
          : best,
      )
      for (const point of ringPoints(ring, 0))
        expect(inside(hem as LoftRing, point, 0.05)).toBe(true)
    }
  })

  it('платье ниже бёдер не пропускает ноги сквозь юбку', () => {
    const dress = buildGarment(body, 'dress', option, '#8a3a5f', 'product')
    const torso = dress.find((part) => part.kind === 'torso')
    const below = (torso?.rings ?? []).filter(
      (ring) => ring.y < body.landmarks.hipsY && ring.y > body.landmarks.crotchY - 10,
    )
    expect(below.length).toBeGreaterThan(0)
    for (const ring of below) {
      for (const leg of [body.parts.leftLeg, body.parts.rightLeg]) {
        const section = leg.sections.find((each) => Math.abs(each.y - ring.y) < 2)
        if (!section?.radii) continue
        const legRing: LoftRing = {
          y: section.y,
          a: 0,
          b: 0,
          centerX: section.centerX,
          centerZ: section.centerZ ?? 0,
          color: [0, 0, 0],
          features: NO_FEATURES,
          foldDepth: 0,
          radii: section.radii,
        }
        for (const point of ringPoints(legRing, 0)) expect(inside(ring, point, 0.5)).toBe(true)
      }
    }
  })

  it('верх штанины доходит до края туловищной части брюк, без ступеньки', () => {
    const jeans = buildGarment(body, 'jeans', option, '#3a5f8a', 'product')
    const torso = jeans.find((part) => part.kind === 'torso')
    const bottom = torso?.rings.reduce((low, ring) => (ring.y < low.y ? ring : low))
    expect(bottom).toBeDefined()
    const outerX = (ring: LoftRing, side: number) =>
      Math.max(...ringPoints(ring, 0).map((point) => point[0] * side))
    for (const leg of jeans.filter((part) => part.kind === 'leg')) {
      const side = Math.sign(leg.rings[0]?.centerX ?? 0)
      const top = leg.rings.reduce((high, ring) => (ring.y > high.y ? ring : high))
      expect(outerX(top, side)).toBeGreaterThan(outerX(bottom as LoftRing, side) - 0.3)
    }
  })
})
