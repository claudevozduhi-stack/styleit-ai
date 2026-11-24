import { describe, expect, it } from 'vitest'
import { validateForm } from './form'

const filled = {
  heightCm: '170',
  weightKg: '60,5',
  chestCm: '90',
  waistCm: '70',
  hipsCm: '96',
  shouldersCm: '',
  inseamCm: '',
}

describe('validateForm', () => {
  it('принимает корректные мерки и запятую как разделитель', () => {
    const result = validateForm('female', filled)
    expect(result).toEqual({
      measurements: {
        gender: 'female',
        heightCm: 170,
        weightKg: 60.5,
        chestCm: 90,
        waistCm: 70,
        hipsCm: 96,
      },
    })
  })

  it('сообщает о пустых обязательных и неверных полях', () => {
    const result = validateForm('male', { ...filled, heightCm: '', chestCm: '999' })
    expect(result).toEqual({
      errors: { heightCm: 'Заполните это поле', chestCm: 'Введите число от 50 до 200' },
    })
  })
})
