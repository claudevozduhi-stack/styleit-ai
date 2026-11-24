// Мерки пользователя. Хранятся только в браузере (см. src/storage).

/** Пол фигуры для построения манекена и выбора одежды. */
export type BodyGender = 'female' | 'male'

/** Мерки тела в сантиметрах и килограммах. */
export interface Measurements {
  gender: BodyGender
  heightCm: number
  weightKg: number
  chestCm: number
  waistCm: number
  hipsCm: number
  /** Ширина плеч — необязательная мерка. */
  shouldersCm?: number
  /** Длина ноги по внутреннему шву — необязательная мерка. */
  inseamCm?: number
}

/** Допустимые диапазоны мерок; совпадают с проверкой на бэкенде. */
export const MEASUREMENT_LIMITS = {
  heightCm: { min: 120, max: 220 },
  weightKg: { min: 30, max: 250 },
  chestCm: { min: 50, max: 200 },
  waistCm: { min: 40, max: 200 },
  hipsCm: { min: 50, max: 200 },
  shouldersCm: { min: 25, max: 70 },
  inseamCm: { min: 50, max: 110 },
} as const satisfies Record<string, { min: number; max: number }>
