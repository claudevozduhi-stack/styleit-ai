// Тесты анатомического тела: разбор файла модели MakeHuman и подгонка под мерки.
import { describe, expect, it } from 'vitest'
import { testHumanModel as model } from '../../tests/humanModelFixture'
import type { Measurements } from '../../types/body'
import { fitHuman } from './humanFit'
import { PART } from './humanModel'
import { girthAt, trianglesOf } from './meshSlice'

const female: Measurements = {
  gender: 'female',
  heightCm: 168,
  weightKg: 60,
  chestCm: 92,
  waistCm: 72,
  hipsCm: 98,
}

describe('модель тела MakeHuman', () => {
  it('разбирает вершины, треугольники, части и морфы', () => {
    expect(model.vertexCount).toBe(13380)
    expect(model.indices.length % 3).toBe(0)
    expect(model.parts.length).toBe(model.vertexCount)
    expect(model.targets.has('female')).toBe(true)
    expect(model.joints.has('l-shoulder')).toBe(true)
  })
})

describe('подгонка под мерки', () => {
  for (const m of [
    female,
    {
      ...female,
      gender: 'male',
      heightCm: 182,
      weightKg: 82,
      chestCm: 102,
      waistCm: 88,
      hipsCm: 100,
    },
    { ...female, heightCm: 155, weightKg: 85, chestCm: 112, waistCm: 98, hipsCm: 116 },
  ] satisfies Measurements[]) {
    it(`рост и обхваты совпадают с мерками: ${m.gender} ${m.heightCm}`, () => {
      const fitted = fitHuman(model, m)
      let top = -Infinity
      let bottom = Infinity
      for (let vertex = 0; vertex < model.vertexCount; vertex += 1) {
        top = Math.max(top, fitted.positions[vertex * 3 + 1] as number)
        bottom = Math.min(bottom, fitted.positions[vertex * 3 + 1] as number)
      }
      expect(top - bottom).toBeGreaterThan(m.heightCm * 0.97)
      expect(top).toBeLessThanOrEqual(m.heightCm + 0.5)
      const torso = trianglesOf(fitted.positions, model.indices, model.parts, new Set([PART.torso]))
      const hips = trianglesOf(
        fitted.positions,
        model.indices,
        model.parts,
        new Set([PART.torso, PART.legPositiveX, PART.legNegativeX]),
      )
      expect(girthAt(fitted.positions, torso, fitted.zoneY.chest)).toBeCloseTo(m.chestCm, -0.3)
      expect(girthAt(fitted.positions, torso, fitted.zoneY.waist)).toBeCloseTo(m.waistCm, -0.3)
      expect(girthAt(fitted.positions, hips, fitted.zoneY.hips)).toBeCloseTo(m.hipsCm, -0.3)
    })
  }
})
