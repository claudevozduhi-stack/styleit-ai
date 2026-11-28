// Тесты швов и строчки: пунктир, цвет нитки, линии по поверхности и сборка для вещей.
import { describe, expect, it } from 'vitest'
import type { SizeOption } from '../../types/analysis'
import { DEFAULT_LOFT, loftMesh, type LoftRing } from '../avatar/loft'
import { buildBodyModel } from '../avatar/sections'
import { buildGarment } from './garment'
import { garmentSceneData } from './scene'
import { DENIM_THREAD, addLine, threadTone, type LineStyle } from './seams'
import { edgePath, type SurfacePoint } from './surfacePath'

const body = buildBodyModel({
  gender: 'female',
  heightCm: 168,
  weightKg: 60,
  chestCm: 90,
  waistCm: 70,
  hipsCm: 96,
})

/** Размер, свободный во всех зонах. */
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

/** Цилиндр радиуса 10 см высотой 40 см, открытый с обеих сторон, с подгибом края. */
function cylinder() {
  const ring = (y: number): LoftRing => ({
    y,
    a: 10,
    b: 10,
    centerX: 0,
    centerZ: 0,
    color: [0.5, 0.5, 0.5],
    features: { bust: 0, buttocks: 0, shoulderBlades: 0, belly: 0 },
    foldDepth: 0,
  })
  return loftMesh([ring(0), ring(40)], { ...DEFAULT_LOFT, edgeThickness: 0.3 })
}

const point = (x: number): SurfacePoint => ({
  position: [x, 0, 0],
  normal: [0, 0, 1],
  color: [0.2, 0.2, 0.2],
})

describe('addLine', () => {
  const buffer = () => ({ positions: [], normals: [], colors: [], indices: [] })
  const style: LineStyle = {
    widthCm: 0.1,
    dashCm: 0.35,
    gapCm: 0.15,
    liftCm: 0.05,
    color: (fabric) => fabric,
  }

  it('кладёт стежки 3,5 мм через 1,5 мм по длине линии', () => {
    const target = buffer()
    // 10 см, разбитые на неравные отрезки: пунктир не должен сбиваться на стыках.
    addLine(target, [point(0), point(1.2), point(7), point(10)], style)
    const quads = target.indices.length / 6
    // Ровно 20 периодов по 0,5 см; стежок на стыке отрезков делится на два четырёхугольника.
    expect(quads).toBeGreaterThanOrEqual(20)
    expect(quads).toBeLessThanOrEqual(22)
    const xs = target.positions.filter((_, index) => index % 3 === 0)
    expect(Math.min(...xs)).toBeCloseTo(0, 6)
    expect(Math.max(...xs)).toBeCloseTo(9.85, 6)
  })

  it('сплошной шов — по одному четырёхугольнику на отрезок, приподнятому над тканью', () => {
    const target = buffer()
    addLine(target, [point(0), point(1), point(3)], { ...style, dashCm: Infinity, gapCm: 0 })
    expect(target.indices.length / 6).toBe(2)
    const zs = target.positions.filter((_, index) => index % 3 === 2)
    for (const z of zs) expect(z).toBeCloseTo(0.05, 6)
  })
})

describe('threadTone', () => {
  it('на тёмной ткани нитка светлее, на светлой — темнее', () => {
    const dark = threadTone([0.1, 0.1, 0.12])
    const light = threadTone([0.9, 0.9, 0.9])
    expect(dark[0]).toBeGreaterThan(0.1)
    expect(light[0]).toBeLessThan(0.9)
  })
})

describe('edgePath', () => {
  it('идёт по поверхности на заданном расстоянии от края и замыкается', () => {
    const mesh = cylinder()
    const layout = mesh.layout
    expect(layout).toBeDefined()
    if (!layout) return
    // Кольцо подгиба внизу и вверху не входит в саму деталь.
    expect(layout.firstRow).toBe(1)
    expect(layout.lastRow).toBe(layout.rows - 2)
    const path = edgePath(mesh, layout, 'bottom', 1.5)
    expect(path).toHaveLength(layout.columns)
    for (const surface of path) {
      expect(surface.position[1]).toBeCloseTo(1.5, 4)
      expect(Math.hypot(surface.position[0], surface.position[2])).toBeCloseTo(10, 1)
    }
    const top = edgePath(mesh, layout, 'top', 2)
    expect(top[0]?.position[1]).toBeCloseTo(38, 4)
  })
})

describe('garmentSceneData', () => {
  it('у джинсов медная двойная строчка, у футболки — нитка в тон', () => {
    const jeans = garmentSceneData(
      buildGarment(body, 'jeans', option, '#3a5f8a', 'product'),
      'jeans',
    )
    expect(jeans.trims.indices.length).toBeGreaterThan(0)
    const colors = Array.from(jeans.trims.colors)
    const hasCopper = colors.some(
      (_, index) =>
        index % 3 === 0 &&
        Math.abs((colors[index] as number) - DENIM_THREAD[0]) < 1e-6 &&
        Math.abs((colors[index + 2] as number) - DENIM_THREAD[2]) < 1e-6,
    )
    expect(hasCopper).toBe(true)

    const tshirt = garmentSceneData(
      buildGarment(body, 'tshirt', option, '#2f3a4a', 'product'),
      'tshirt',
    )
    expect(tshirt.trims.indices.length).toBeGreaterThan(0)
    expect(Array.from(tshirt.trims.colors).some((value) => value === DENIM_THREAD[0])).toBe(false)
  })

  it('швы лежат на ткани: каждая вершина строчки рядом с вершиной детали', () => {
    const data = garmentSceneData(
      buildGarment(body, 'shirt', option, '#f0f0f0', 'product'),
      'shirt',
    )
    const fabric = data.meshes.flatMap((mesh) => {
      const points: number[][] = []
      for (let index = 0; index < mesh.positions.length; index += 3) {
        points.push([
          mesh.positions[index] as number,
          mesh.positions[index + 1] as number,
          mesh.positions[index + 2] as number,
        ])
      }
      return points
    })
    const trims = data.trims.positions
    // Проверяем каждую 40-ю вершину: расстояние до ткани не больше шага решётки.
    for (let index = 0; index < trims.length; index += 3 * 40) {
      const x = trims[index] as number
      const y = trims[index + 1] as number
      const z = trims[index + 2] as number
      const nearest = Math.min(
        ...fabric.map(([fx, fy, fz]) => Math.hypot(x - (fx ?? 0), y - (fy ?? 0), z - (fz ?? 0))),
      )
      expect(nearest).toBeLessThan(3)
    }
  })
})
