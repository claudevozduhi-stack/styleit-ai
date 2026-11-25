import { describe, expect, it } from 'vitest'
import { buildQuery, resolveApiUrl } from './client'

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

describe('resolveApiUrl', () => {
  it('берёт адрес из настройки и убирает слеш в конце', () => {
    expect(resolveApiUrl('https://api.example.com/', false)).toBe('https://api.example.com')
  })

  it('в разработке без настройки идёт на localhost', () => {
    expect(resolveApiUrl(undefined, true)).toBe('http://localhost:8000')
  })

  it('в собранном сайте без настройки не подставляет localhost', () => {
    expect(resolveApiUrl(undefined, false)).toBe('')
    expect(resolveApiUrl('  ', false)).toBe('')
  })
})
