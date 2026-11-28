// Тесты мягкого затенения одежды и деталей джинсов.
import { describe, expect, it } from 'vitest'
import type { SizeOption } from '../../types/analysis'
import { buildBodyModel } from '../avatar/sections'
import { buildGarment } from './garment'
import { bodyOccluders, occlusionAt, shadeGarmentMesh, sphereOcclusion } from './occlusion'
import { garmentMeshes, garmentSceneData } from './scene'

const body = buildBodyModel({
  gender: 'female',
  heightCm: 168,
  weightKg: 60,
  chestCm: 90,
  waistCm: 70,
  hipsCm: 96,
})

const option: SizeOption = {
  size_label: 'M',
  size_order: 2,
  score: 0,
  zones: (['chest', 'waist', 'hips'] as const).map((zone) => ({
    zone,
    body_cm: 90,
    size_min_cm: 92,
    size_max_cm: 98,
    excess_cm: 0,
    fit: 'good' as const,
  })),
}

describe('sphereOcclusion', () => {
  const ball = { center: [0, 0, 10] as [number, number, number], radius: 5, weight: 1 }

  it('шар перед тканью закрывает свет, шар за тканью — нет', () => {
    expect(sphereOcclusion([0, 0, 0], [0, 0, 1], ball)).toBeCloseTo(0.25, 6)
    expect(sphereOcclusion([0, 0, 0], [0, 0, -1], ball)).toBe(0)
  })

  it('дальний шар заслоняет меньше ближнего', () => {
    const far = { ...ball, center: [0, 0, 30] as [number, number, number] }
    expect(sphereOcclusion([0, 0, 0], [0, 0, 1], far)).toBeLessThan(
      sphereOcclusion([0, 0, 0], [0, 0, 1], ball),
    )
  })
})

describe('shadeGarmentMesh', () => {
  it('у брюк внутренняя сторона штанины темнее внешней', () => {
    const occluders = bodyOccluders(body)
    const legs = garmentMeshes(buildGarment(body, 'trousers', option, '#808080', 'product')).slice(
      1,
    )
    const leftLeg = legs[0]
    expect(leftLeg?.layout).toBeDefined()
    if (!leftLeg?.layout) return
    // Середина штанины по высоте; внутренняя сторона — та, что ближе к другой ноге (x ближе к 0).
    const row = Math.round((leftLeg.layout.firstRow + leftLeg.layout.lastRow) / 2)
    const xs: Array<{ x: number; occlusion: number }> = []
    for (let column = 0; column < leftLeg.layout.columns - 1; column += 1) {
      const index = row * leftLeg.layout.columns + column
      const point = [0, 1, 2].map((axis) => leftLeg.positions[index * 3 + axis] as number)
      const normal = [0, 1, 2].map((axis) => leftLeg.normals[index * 3 + axis] as number)
      xs.push({
        x: point[0] as number,
        occlusion: occlusionAt(
          point as [number, number, number],
          normal as [number, number, number],
          occluders,
        ),
      })
    }
    xs.sort((a, b) => Math.abs(a.x) - Math.abs(b.x))
    expect((xs[0] as { occlusion: number }).occlusion).toBeGreaterThan(
      (xs[xs.length - 1] as { occlusion: number }).occlusion,
    )
  })

  it('только затемняет: цвет не светлее исходного и не меняет геометрию', () => {
    const mesh = garmentMeshes(buildGarment(body, 'tshirt', option, '#a0a0a0', 'product'))[0]
    if (!mesh) throw new Error('нет сетки')
    const shaded = shadeGarmentMesh(mesh, bodyOccluders(body))
    expect(shaded.positions).toBe(mesh.positions)
    let darker = 0
    shaded.colors.forEach((value, index) => {
      expect(value).toBeLessThanOrEqual((mesh.colors[index] as number) + 1e-7)
      if (value < (mesh.colors[index] as number) - 1e-3) darker += 1
    })
    expect(darker).toBeGreaterThan(0)
  })
})

describe('детали джинсов', () => {
  it('у джинсов есть карманы и кокетка, поэтому строчки больше, чем у брюк', () => {
    const jeans = garmentSceneData(
      buildGarment(body, 'jeans', option, '#3a5f8a', 'product'),
      'jeans',
      '',
      body,
    )
    const trousers = garmentSceneData(
      buildGarment(body, 'trousers', option, '#3a5f8a', 'product'),
      'trousers',
      'Брюки из денима',
      body,
    )
    expect(jeans.trims.indices.length).toBeGreaterThan(trousers.trims.indices.length * 1.3)
  })

  it('задние карманы стоят симметрично на спинке', () => {
    const jeans = garmentSceneData(
      buildGarment(body, 'jeans', option, '#3a5f8a', 'product'),
      'jeans',
    )
    // Вершины строчки на спинке (z < 0) в зоне карманов — по обе стороны от середины.
    const positions = jeans.trims.positions
    const torsoCenter = 0
    let left = 0
    let right = 0
    for (let index = 0; index < positions.length; index += 3) {
      const x = positions[index] as number
      const z = positions[index + 2] as number
      if (z >= -3) continue
      if (x < torsoCenter - 3) left += 1
      if (x > torsoCenter + 3) right += 1
    }
    expect(left).toBeGreaterThan(100)
    expect(Math.abs(left - right) / Math.max(left, right)).toBeLessThan(0.2)
  })
})
