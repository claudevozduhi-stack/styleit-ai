import { describe, expect, it } from 'vitest'
import { ITEM_FORMS, formatKzt, pluralRu } from './labels'

describe('formatKzt', () => {
  it('разделяет разряды и добавляет знак тенге', () => {
    expect(formatKzt(12990).replace(/\s/g, ' ')).toBe('12 990 ₸')
  })
})

describe('pluralRu', () => {
  it('склоняет по последней цифре и учитывает 11–14', () => {
    expect(pluralRu(1, ITEM_FORMS)).toBe('1 вещь')
    expect(pluralRu(3, ITEM_FORMS)).toBe('3 вещи')
    expect(pluralRu(5, ITEM_FORMS)).toBe('5 вещей')
    expect(pluralRu(12, ITEM_FORMS)).toBe('12 вещей')
    expect(pluralRu(21, ITEM_FORMS)).toBe('21 вещь')
  })
})
