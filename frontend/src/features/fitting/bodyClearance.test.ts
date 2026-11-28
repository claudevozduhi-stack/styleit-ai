// Тесты зазора ткани от тела: выступ тела отодвигает ткань, тело внутри её не трогает.
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOFT, loftMesh, type LoftRing, type MeshData } from '../avatar/loft'
import { PART } from '../avatar/humanModel'
import type { BodySurface } from '../avatar/sections'
import { BODY_CLEARANCE_CM, clearBody, wearOnSurface } from './bodyClearance'

/** Труба-«туловище» радиуса 10 см от 0 до 40 см. */
function tube(): MeshData {
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
  return loftMesh([0, 10, 20, 30, 40].map(ring), DEFAULT_LOFT)
}

/** Поверхность тела из отдельных точек одной части. */
function surfaceOf(points: [number, number, number][], part: number = PART.torso): BodySurface {
  return {
    positions: Float32Array.from(points.flat()),
    parts: new Uint8Array(points.length).fill(part),
    count: points.length,
  }
}

/** Наибольшее удаление вершин от оси трубы вдоль оси X (direction = 1 или −1) у высоты y. */
function radiusTowardX(mesh: MeshData, y: number, direction = 1): number {
  let best = 0
  for (let index = 0; index < mesh.positions.length; index += 3) {
    const x = (mesh.positions[index] as number) * direction
    const z = mesh.positions[index + 2] as number
    if (Math.abs((mesh.positions[index + 1] as number) - y) > 0.5 || Math.abs(z) > 1) continue
    best = Math.max(best, x)
  }
  return best
}

describe('clearBody', () => {
  it('не трогает ткань, если тело внутри с запасом', () => {
    const mesh = tube()
    const cleared = clearBody(
      mesh,
      'torso',
      surfaceOf([
        [5, 20, 0],
        [0, 20, -5],
      ]),
    )
    expect(cleared).toBe(mesh)
  })

  it('отодвигает ткань за выступ тела на зазор', () => {
    const mesh = tube()
    // Точка тела в 12 см от оси — на 2 см снаружи ткани.
    const cleared = clearBody(mesh, 'torso', surfaceOf([[12, 20, 0]]))
    expect(radiusTowardX(cleared, 20)).toBeGreaterThanOrEqual(12 + BODY_CLEARANCE_CM - 0.05)
    // Противоположная сторона на месте.
    expect(radiusTowardX(cleared, 20, -1)).toBeCloseTo(10, 1)
  })

  it('не учитывает чужие части тела: рукав не отодвигается от ноги', () => {
    const mesh = tube()
    const leg = surfaceOf([[12, 20, 0]], PART.legPositiveX)
    expect(clearBody(mesh, 'sleeve', leg)).toBe(mesh)
  })
})

describe('wearOnSurface', () => {
  it('добавляет вершины детали к телу с номером закрытой части', () => {
    const body = surfaceOf([[0, 0, 0]])
    const worn = wearOnSurface(body, tube(), 'torso')
    expect(worn.count).toBeGreaterThan(body.count)
    expect(worn.parts[worn.count - 1]).toBe(PART.torso)
    // Следующий слой той же формы отодвигается от надетого на зазор.
    const outer = clearBody(tube(), 'torso', worn)
    expect(radiusTowardX(outer, 20)).toBeGreaterThanOrEqual(10 + BODY_CLEARANCE_CM - 0.05)
  })
})
