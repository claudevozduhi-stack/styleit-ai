// Тесты сечений подогнанного тела и его сетки для сцены.
import { describe, expect, it } from 'vitest'
import { testHumanModel as model } from '../../tests/humanModelFixture'
import type { Measurements } from '../../types/body'
import { fitHuman } from './humanFit'
import { humanMeshData } from './humanMesh'
import { humanBodyModel } from './humanSections'
import { DEFAULT_LOFT } from './loft'

const female: Measurements = {
  gender: 'female',
  heightCm: 168,
  weightKg: 60,
  chestCm: 92,
  waistCm: 72,
  hipsCm: 98,
}
const fitted = fitHuman(model, female)
const body = humanBodyModel(model, fitted)

describe('модель тела по скану', () => {
  it('уровни тела идут снизу вверх в правильном порядке', () => {
    const l = body.landmarks
    const order = [
      l.ankleY,
      l.kneeY,
      l.crotchY,
      l.hipsY,
      l.waistY,
      l.chestY,
      l.shoulderY,
      l.neckBaseY,
      l.neckTopY,
    ]
    expect(order).toEqual([...order].sort((first, second) => first - second))
    // Бёдра выше промежности, грудь — примерно на 0,7 роста.
    expect(l.hipsY - l.crotchY).toBeGreaterThan(0.03 * female.heightCm)
    expect(l.chestY / female.heightCm).toBeGreaterThan(0.68)
    expect(l.chestY / female.heightCm).toBeLessThan(0.76)
  })

  it('у каждой части есть сечения по возрастанию высоты с контуром со скана', () => {
    for (const part of Object.values(body.parts)) {
      expect(part.sections.length).toBeGreaterThan(5)
      const ys = part.sections.map((section) => section.y)
      expect(ys).toEqual([...ys].sort((first, second) => first - second))
      for (const section of part.sections) {
        expect(section.radii).toHaveLength(DEFAULT_LOFT.radialSegments)
      }
    }
  })

  it('обхваты сечений зон совпадают с мерками до 1 см', () => {
    const zones = body.parts.torso.sections.filter((section) => section.zone)
    const byZone = Object.fromEntries(zones.map((section) => [section.zone, section.girth]))
    expect(byZone.chest).toBeCloseTo(female.chestCm, -0.3)
    expect(byZone.waist).toBeCloseTo(female.waistCm, -0.3)
    expect(byZone.hips).toBeCloseTo(female.hipsCm, -0.3)
  })

  it('левая нога лежит при x < 0, правая — при x > 0', () => {
    const middle = (sections: typeof body.parts.leftLeg.sections) =>
      sections[Math.floor(sections.length / 2)]?.centerX ?? 0
    expect(middle(body.parts.leftLeg.sections)).toBeLessThan(0)
    expect(middle(body.parts.rightLeg.sections)).toBeGreaterThan(0)
  })
})

describe('сетка тела для сцены', () => {
  it('только вершины тела, нормали единичной длины, один цвет', () => {
    const mesh = humanMeshData(model, fitted.positions, [0.9, 0.88, 0.86])
    expect(mesh.positions.length).toBe(model.vertexCount * 3)
    expect(mesh.indices.length).toBe(model.indices.length)
    for (let vertex = 0; vertex < model.vertexCount; vertex += 997) {
      const length = Math.hypot(
        mesh.normals[vertex * 3] as number,
        mesh.normals[vertex * 3 + 1] as number,
        mesh.normals[vertex * 3 + 2] as number,
      )
      expect(length).toBeCloseTo(1, 5)
      expect(mesh.colors[vertex * 3]).toBeCloseTo(0.9)
    }
  })

  it('нормаль на макушке смотрит вверх', () => {
    const mesh = humanMeshData(model, fitted.positions, [1, 1, 1])
    let top = 0
    for (let vertex = 0; vertex < model.vertexCount; vertex += 1) {
      if ((mesh.positions[vertex * 3 + 1] as number) > (mesh.positions[top * 3 + 1] as number)) {
        top = vertex
      }
    }
    expect(mesh.normals[top * 3 + 1]).toBeGreaterThan(0.9)
  })
})
