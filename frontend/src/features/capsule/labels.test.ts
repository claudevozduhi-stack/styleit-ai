import { describe, expect, it } from 'vitest'
import { formatKzt } from './labels'

describe('formatKzt', () => {
  it('разделяет разряды и добавляет знак тенге', () => {
    expect(formatKzt(12990).replace(/\s/g, ' ')).toBe('12 990 ₸')
  })
})
