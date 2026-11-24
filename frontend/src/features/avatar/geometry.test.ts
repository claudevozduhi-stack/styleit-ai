// Тесты геометрии манекена: эллипсы, сечения по меркам и сетка-лофт.
import { describe, expect, it } from 'vitest'
import type { Measurements } from '../../types/body'
import { ellipseForGirth, ramanujanPerimeter } from './ellipse'
import { DEFAULT_LOFT, loftMesh, toRing } from './loft'
import { buildBodyModel, sectionAt, sliceSections } from './sections'

const measurements: Measurements = {
  gender: 'female',
  heightCm: 168,
  weightKg: 60,
  chestCm: 90,
  waistCm: 70,
  hipsCm: 96,
}

/** Периметр многоугольника по точкам кольца (x, z) — проверка, что сетка держит обхват. */
function ringPerimeter(positions: Float32Array, start: number, segments: number): number {
  let perimeter = 0
  for (let k = 0; k < segments; k += 1) {
    const i = (start + k) * 3
    const j = (start + ((k + 1) % segments)) * 3
    perimeter += Math.hypot(
      (positions[j] as number) - (positions[i] as number),
      (positions[j + 2] as number) - (positions[i + 2] as number),
    )
  }
  return perimeter
}

describe('ellipse', () => {
  it('для круга даёт 2πr', () => {
    expect(ramanujanPerimeter(10, 10)).toBeCloseTo(2 * Math.PI * 10, 6)
  })

  it('подбирает полуоси с периметром, равным обхвату', () => {
    const { a, b } = ellipseForGirth(90, 0.7)
    expect(b / a).toBeCloseTo(0.7, 6)
    expect(ramanujanPerimeter(a, b)).toBeCloseTo(90, 6)
  })

  it('отклоняет неположительный обхват', () => {
    expect(() => ellipseForGirth(0, 0.7)).toThrow(RangeError)
  })
})

describe('buildBodyModel', () => {
  const body = buildBodyModel(measurements)

  it('сечения груди, талии и бёдер равны меркам', () => {
    const byZone = Object.fromEntries(
      body.parts.torso.sections.filter((s) => s.zone).map((s) => [s.zone, s.girth]),
    )
    expect(byZone).toEqual({ chest: 90, waist: 70, hips: 96 })
  })

  it('все части тела идут снизу вверх и не выше роста', () => {
    for (const part of Object.values(body.parts)) {
      const heights = part.sections.map((s) => s.y)
      expect(heights).toEqual([...heights].sort((x, y) => x - y))
      expect(Math.max(...heights)).toBeLessThan(measurements.heightCm)
    }
    expect(body.head.y + body.head.radius).toBeLessThanOrEqual(measurements.heightCm)
  })

  it('учитывает длину ноги по шву, но в разумных пределах', () => {
    expect(buildBodyModel({ ...measurements, inseamCm: 80 }).landmarks.crotchY).toBe(80)
    expect(buildBodyModel({ ...measurements, inseamCm: 110 }).landmarks.crotchY).toBeCloseTo(
      0.49 * 168,
    )
  })

  it('ноги и руки симметричны', () => {
    const left = body.parts.leftLeg.sections.map((s) => s.centerX)
    const right = body.parts.rightLeg.sections.map((s) => -s.centerX)
    expect(left).toEqual(right)
  })
})

describe('sliceSections', () => {
  const torso = buildBodyModel(measurements).parts.torso.sections

  it('добавляет сечения точно на границах диапазона', () => {
    const slice = sliceSections(torso, 90, 110)
    expect(slice[0]?.y).toBe(90)
    expect(slice[slice.length - 1]?.y).toBe(110)
    expect(slice.every((s) => s.y >= 90 && s.y <= 110)).toBe(true)
  })

  it('интерполирует обхват между соседними сечениями', () => {
    const waist = torso.find((s) => s.zone === 'waist')!
    const chest = torso.find((s) => s.zone === 'chest')!
    const girth = sectionAt(torso, (waist.y + chest.y) / 2).girth
    expect(girth).toBeGreaterThan(waist.girth)
    expect(girth).toBeLessThan(chest.girth)
  })
})

describe('loftMesh', () => {
  const sections = buildBodyModel(measurements).parts.torso.sections
  const rings = sections.map((s) => toRing(s, [1, 1, 1]))
  const ringCount = (rings.length - 1) * DEFAULT_LOFT.stepsPerSpan + 1
  // У каждого кольца на одну вершину больше: дубль шва для развёртки фактуры.
  const columns = DEFAULT_LOFT.radialSegments + 1

  it('строит согласованные вершины, нормали, цвета, развёртку и индексы', () => {
    const mesh = loftMesh(rings, { ...DEFAULT_LOFT, capBottom: true, capTop: true })
    const vertexCount = ringCount * columns + 2
    expect(mesh.positions.length).toBe(vertexCount * 3)
    expect(mesh.normals.length).toBe(vertexCount * 3)
    expect(mesh.colors.length).toBe(vertexCount * 3)
    expect(mesh.uvs.length).toBe(vertexCount * 2)
    expect(Math.max(...mesh.indices)).toBe(vertexCount - 1)
    expect(mesh.indices.length % 3).toBe(0)
  })

  it('нормали единичные и смотрят наружу от оси туловища', () => {
    const mesh = loftMesh(rings)
    const chestRing = sections.findIndex((s) => s.zone === 'chest') * DEFAULT_LOFT.stepsPerSpan
    for (let k = 0; k < DEFAULT_LOFT.radialSegments; k += 1) {
      const i = (chestRing * columns + k) * 3
      const [x, z] = [mesh.positions[i] as number, mesh.positions[i + 2] as number]
      const [nx, ny, nz] = [mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]] as number[]
      expect(Math.hypot(nx!, ny!, nz!)).toBeCloseTo(1, 5)
      expect(x * nx! + z * nz!).toBeGreaterThan(0)
    }
  })

  it('кольцо на уровне груди сохраняет обхват из мерок, несмотря на выпуклости', () => {
    const segments = 200
    const mesh = loftMesh(rings, { ...DEFAULT_LOFT, radialSegments: segments })
    const chestIndex = sections.findIndex((s) => s.zone === 'chest')
    const ringIndex = chestIndex * DEFAULT_LOFT.stepsPerSpan
    expect(sections[chestIndex]?.features?.bust).toBeGreaterThan(0)
    expect(ringPerimeter(mesh.positions, ringIndex * (segments + 1), segments)).toBeCloseTo(90, 0)
  })

  it('подгиб ткани добавляет по кольцу на открытых краях', () => {
    const plain = loftMesh(rings)
    const hemmed = loftMesh(rings, { ...DEFAULT_LOFT, edgeThickness: 0.6 })
    expect(hemmed.positions.length - plain.positions.length).toBe(2 * columns * 3)
  })
})
