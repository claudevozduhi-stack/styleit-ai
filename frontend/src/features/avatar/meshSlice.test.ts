// Тесты срезов сетки: выпуклая оболочка, периметр и сглаживание контура.
import { describe, expect, it } from 'vitest'
import { convexHull, perimeter, smoothAround, type Point2 } from './meshSlice'

describe('meshSlice', () => {
  it('оболочка квадрата с точкой внутри — сам квадрат, периметр 4', () => {
    const points: Point2[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0.5, 0.5],
    ]
    const hull = convexHull(points)
    expect(hull).toHaveLength(4)
    expect(perimeter(hull)).toBeCloseTo(4, 6)
  })

  it('сглаживание по окружности убирает излом и почти не уменьшает выступ', () => {
    const radii = Array.from({ length: 16 }, (_, k) => (k === 4 ? 12 : 10))
    const smooth = smoothAround(radii, 2)
    expect(smooth[4]).toBeLessThan(12)
    expect(smooth[4]).toBeGreaterThanOrEqual(12 * 0.99)
    expect(smooth[3]).toBeGreaterThan(10)
  })
})
