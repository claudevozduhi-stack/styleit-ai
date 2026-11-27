import { describe, expect, it } from 'vitest'
// Сырой CSV размерных сеток: тест сверяет с ним захардкоженную таблицу пресетов.
import sizeChartsCsv from '../../../../data/size_charts/size_charts.csv?raw'
import type { BodyGender } from '../../types/body'
import {
  PRESET_KEYS,
  SIZE_LABELS,
  SIZE_PRESETS,
  presetFormValues,
  presetHint,
  type CmRange,
  type PresetKey,
  type SizeLabel,
} from './sizePresets'

/** Колонки CSV для каждой мерки пресета. */
const CSV_COLUMNS: Record<PresetKey, string> = {
  chestCm: 'chest',
  waistCm: 'waist',
  hipsCm: 'hips',
}

/** Пересчитывает усреднённый диапазон по брендам тем же способом, что описан в sizePresets.ts. */
function averagedRange(gender: BodyGender, size: SizeLabel, key: PresetKey): CmRange {
  const [header, ...lines] = sizeChartsCsv.trim().split('\n')
  const columns = header.split(',')
  const column = (row: string[], name: string) => row[columns.indexOf(name)]
  const unique = new Map<string, CmRange>()
  for (const line of lines) {
    const row = line.split(',')
    const min = column(row, `${CSV_COLUMNS[key]}_min`)
    const max = column(row, `${CSV_COLUMNS[key]}_max`)
    if (column(row, 'gender') !== gender || column(row, 'size_label') !== size || !min) continue
    unique.set(`${column(row, 'brand')}|${min}|${max}`, { min: Number(min), max: Number(max) })
  }
  const ranges = [...unique.values()]
  const average = (pick: (range: CmRange) => number) =>
    Math.round(ranges.reduce((sum, range) => sum + pick(range), 0) / ranges.length)
  return { min: average((range) => range.min), max: average((range) => range.max) }
}

describe('SIZE_PRESETS', () => {
  it('совпадает с усреднёнными размерными сетками из data/size_charts', () => {
    for (const gender of ['female', 'male'] as const) {
      for (const size of SIZE_LABELS) {
        for (const key of PRESET_KEYS) {
          expect(SIZE_PRESETS[gender][size].ranges[key], `${gender} ${size} ${key}`).toEqual(
            averagedRange(gender, size, key),
          )
        }
      }
    }
  })

  it('растёт от меньшего размера к большему', () => {
    for (const gender of ['female', 'male'] as const) {
      for (const key of PRESET_KEYS) {
        const mins = SIZE_LABELS.map((size) => SIZE_PRESETS[gender][size].ranges[key].min)
        expect(mins).toEqual([...mins].sort((a, b) => a - b))
      }
    }
  })
})

describe('presetFormValues и presetHint', () => {
  it('подставляет середины диапазонов', () => {
    expect(presetFormValues('male', 'M')).toEqual({ chestCm: '97', waistCm: '85', hipsCm: '96' })
  })

  it('пишет диапазон или одно число, если границы совпадают', () => {
    expect(presetHint('female', 'M', 'chestCm')).toBe('Для M обычно 90–94 см')
    expect(presetHint('female', 'M', 'hipsCm')).toBe('Для M обычно 97 см')
  })
})
