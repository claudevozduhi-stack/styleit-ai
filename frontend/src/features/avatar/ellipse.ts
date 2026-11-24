// Геометрия эллипса: периметр по Рамануджану и подбор полуосей под заданный обхват.

/** Полуоси эллиптического сечения в сантиметрах: a — по ширине (ось X), b — по глубине (ось Z). */
export interface EllipseAxes {
  a: number
  b: number
}

/**
 * Периметр эллипса по второй формуле Рамануджана.
 * Погрешность меньше 0,01 % для пропорций тела, этого достаточно для обхватов в сантиметрах.
 */
export function ramanujanPerimeter(a: number, b: number): number {
  const h = ((a - b) / (a + b)) ** 2
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
}

/**
 * Полуоси эллипса с периметром, равным обхвату `girthCm`, при отношении глубины к ширине `depthRatio`.
 * Периметр линеен по масштабу, поэтому достаточно посчитать его для a = 1 и разделить обхват.
 */
export function ellipseForGirth(girthCm: number, depthRatio: number): EllipseAxes {
  if (girthCm <= 0 || depthRatio <= 0) {
    throw new RangeError('Обхват и отношение осей должны быть положительными')
  }
  const a = girthCm / ramanujanPerimeter(1, depthRatio)
  return { a, b: a * depthRatio }
}
