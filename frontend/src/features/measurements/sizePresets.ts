// Типичные обхваты для быстрого выбора размера на странице мерок.
//
// Цифры получены из наших размерных сеток data/size_charts/size_charts.csv: для каждого
// пола и размера взяты все бренды, у которых есть эта мерка, и усреднены нижняя и верхняя
// границы (одинаковые сетки одного бренда учитываются один раз, итог округлён до сантиметра).
// Тест sizePresets.test.ts пересчитывает таблицу из CSV и падает, если она разошлась с данными.
import type { BodyGender } from '../../types/body'

/** Международные буквенные размеры, доступные в быстром выборе. */
export const SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const

export type SizeLabel = (typeof SIZE_LABELS)[number]

/** Мерки, которые заполняет быстрый выбор размера. */
export type PresetKey = 'chestCm' | 'waistCm' | 'hipsCm'

export const PRESET_KEYS: readonly PresetKey[] = ['chestCm', 'waistCm', 'hipsCm']

/** Диапазон обхвата в сантиметрах, границы включительно. */
export interface CmRange {
  min: number
  max: number
}

/** Типичный размер: российский эквивалент и диапазоны обхватов. */
export interface SizePreset {
  /** Российский размер (для мужской фигуры XXL соответствует 54–56). */
  ruLabel: string
  ranges: Record<PresetKey, CmRange>
}

/** Таблица типичных обхватов по полу и размеру (см. комментарий в начале файла). */
export const SIZE_PRESETS: Record<BodyGender, Record<SizeLabel, SizePreset>> = {
  female: {
    XS: preset('42', [78, 82], [62, 64], [89, 89]),
    S: preset('44', [84, 88], [67, 69], [93, 93]),
    M: preset('46', [90, 94], [72, 74], [97, 97]),
    L: preset('48', [96, 100], [78, 81], [105, 105]),
    XL: preset('50', [103, 108], [85, 89], [112, 112]),
    XXL: preset('52', [110, 116], [93, 99], [118, 122]),
  },
  male: {
    XS: preset('44', [83, 86], [71, 74], [82, 85]),
    S: preset('46', [87, 92], [75, 80], [86, 91]),
    M: preset('48', [93, 100], [81, 88], [92, 99]),
    L: preset('50', [101, 108], [89, 96], [100, 107]),
    XL: preset('52', [109, 118], [97, 106], [108, 116]),
    XXL: preset('54–56', [119, 130], [107, 119], [117, 125]),
  },
}

/** Собирает запись таблицы из пар [min, max] для груди, талии и бёдер. */
function preset(
  ruLabel: string,
  chest: [number, number],
  waist: [number, number],
  hips: [number, number],
): SizePreset {
  const range = ([min, max]: [number, number]): CmRange => ({ min, max })
  return { ruLabel, ranges: { chestCm: range(chest), waistCm: range(waist), hipsCm: range(hips) } }
}

/** Середина диапазона, округлённая до целого сантиметра: её подставляем в поле формы. */
export function rangeMidpoint(range: CmRange): number {
  return Math.round((range.min + range.max) / 2)
}

/** Значения полей формы для выбранного размера: середины диапазонов в виде строк. */
export function presetFormValues(gender: BodyGender, size: SizeLabel): Record<PresetKey, string> {
  const { ranges } = SIZE_PRESETS[gender][size]
  return {
    chestCm: String(rangeMidpoint(ranges.chestCm)),
    waistCm: String(rangeMidpoint(ranges.waistCm)),
    hipsCm: String(rangeMidpoint(ranges.hipsCm)),
  }
}

/** Подсказка под полем, например «Для M обычно 90–94 см». */
export function presetHint(gender: BodyGender, size: SizeLabel, key: PresetKey): string {
  const { min, max } = SIZE_PRESETS[gender][size].ranges[key]
  const span = min === max ? `${min}` : `${min}–${max}`
  return `Для ${size} обычно ${span} см`
}
