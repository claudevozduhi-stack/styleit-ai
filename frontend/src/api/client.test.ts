import { describe, expect, it } from 'vitest'
import { buildQuery } from './client'

describe('buildQuery', () => {
  it('пропускает пустые значения', () => {
    expect(buildQuery({ category: 'tshirt', style: undefined, max_price: 5000 })).toBe(
      '?category=tshirt&max_price=5000',
    )
  })

  it('возвращает пустую строку без параметров', () => {
    expect(buildQuery({})).toBe('')
  })
})
