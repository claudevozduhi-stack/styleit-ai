import { beforeEach, describe, expect, it } from 'vitest'
import type { Measurements } from '../types/body'
import {
  clearAllUserData,
  isValidMeasurements,
  loadMeasurements,
  saveMeasurements,
} from './localStore'

const sample: Measurements = {
  gender: 'female',
  heightCm: 168,
  weightKg: 58,
  chestCm: 88,
  waistCm: 68,
  hipsCm: 94,
}

describe('localStore', () => {
  beforeEach(() => window.localStorage.clear())

  it('сохраняет и читает мерки', () => {
    expect(saveMeasurements(sample)).toBe(true)
    expect(loadMeasurements()).toEqual(sample)
  })

  it('игнорирует повреждённые данные', () => {
    window.localStorage.setItem('styleit:measurements', '{не json')
    expect(loadMeasurements()).toBeNull()
  })

  it('отклоняет мерки вне диапазона', () => {
    expect(isValidMeasurements({ ...sample, heightCm: 400 })).toBe(false)
    expect(isValidMeasurements({ ...sample, inseamCm: 5 })).toBe(false)
  })

  it('удаляет только свои ключи', () => {
    saveMeasurements(sample)
    window.localStorage.setItem('other-app', 'keep')
    clearAllUserData()
    expect(loadMeasurements()).toBeNull()
    expect(window.localStorage.getItem('other-app')).toBe('keep')
  })
})
