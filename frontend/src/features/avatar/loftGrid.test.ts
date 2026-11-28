// Тесты развёртки и нормалей сетки лофта.
import { describe, expect, it } from 'vitest'
import { arcLengthU, smoothNormalsVertically, TEXTURE_UNIT_CM, tilesAroundFor } from './loftGrid'

/** Контур-эллипс из count точек. */
function ellipse(radiusX: number, radiusZ: number, count: number): Array<[number, number]> {
  return Array.from({ length: count }, (_, k) => {
    const angle = (2 * Math.PI * k) / count
    return [radiusX * Math.cos(angle), radiusZ * Math.sin(angle)] as [number, number]
  })
}

describe('arcLengthU', () => {
  it('идёт от 0 до целого числа повторов, поэтому на шве нет разрыва', () => {
    const around = arcLengthU(ellipse(20, 10, 48), 9)
    expect(around).toHaveLength(49)
    expect(around[0]).toBe(0)
    expect(around[48]).toBeCloseTo(9, 6)
    for (let k = 1; k < around.length; k += 1) {
      expect(around[k] as number).toBeGreaterThan(around[k - 1] as number)
    }
  })

  it('шаг по длине дуги одинаков, даже если точки контура стоят неравномерно', () => {
    // Половина точек сгущена на первой четверти квадрата: шаг u должен это учесть.
    const square: Array<[number, number]> = [
      [0, 0],
      [5, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]
    const around = arcLengthU(square, 4)
    expect(around[1]).toBeCloseTo(0.5, 6)
    expect(around[3]).toBeCloseTo(2, 6)
  })
})

describe('tilesAroundFor', () => {
  it('считает повторы по среднему обхвату детали', () => {
    const torso = ellipse(16, 12, 96)
    const perimeter = 2 * Math.PI * Math.sqrt((16 ** 2 + 12 ** 2) / 2)
    expect(tilesAroundFor([torso])).toBe(Math.round(perimeter / TEXTURE_UNIT_CM))
  })

  it('у тонкой детали хотя бы один повтор', () => {
    expect(tilesAroundFor([ellipse(0.5, 0.5, 16)])).toBe(1)
    expect(tilesAroundFor([])).toBe(1)
  })
})

describe('smoothNormalsVertically', () => {
  it('сглаживает излом нормали между кольцами и сохраняет длину 1', () => {
    // Три кольца по одному столбцу: средняя нормаль смотрит вверх, соседние — вбок.
    const normals = [1, 0, 0, 0, 1, 0, 1, 0, 0]
    const smoothed = smoothNormalsVertically(normals, 3, 1, 1)
    const middle = smoothed.slice(3, 6)
    expect(middle[0] as number).toBeGreaterThan(0.5)
    expect(Math.hypot(...middle)).toBeCloseTo(1, 6)
    // Крайние кольца не трогаются: у них нет соседа с одной стороны.
    expect(smoothed.slice(0, 3)).toEqual([1, 0, 0])
  })

  it('не меняет и без того плавные нормали', () => {
    const normals = Array.from({ length: 5 * 2 }, () => [0, 0, 1]).flat()
    expect(smoothNormalsVertically(normals, 5, 2, 4)).toEqual(normals)
  })
})
