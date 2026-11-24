// Описание полей формы мерок и их проверка. Чистые функции без React — их легко тестировать.
import { MEASUREMENT_LIMITS, type BodyGender, type Measurements } from '../../types/body'

export type NumericKey = Exclude<keyof Measurements, 'gender'>

export interface FieldSpec {
  key: NumericKey
  label: string
  hint: string
  required: boolean
}

export const FIELDS: FieldSpec[] = [
  { key: 'heightCm', label: 'Рост, см', hint: 'Без обуви', required: true },
  { key: 'weightKg', label: 'Вес, кг', hint: '', required: true },
  {
    key: 'chestCm',
    label: 'Обхват груди, см',
    hint: 'По самым выступающим точкам',
    required: true,
  },
  { key: 'waistCm', label: 'Обхват талии, см', hint: 'По самому узкому месту', required: true },
  { key: 'hipsCm', label: 'Обхват бёдер, см', hint: 'По самым выступающим точкам', required: true },
  { key: 'shouldersCm', label: 'Ширина плеч, см', hint: 'Необязательно', required: false },
  {
    key: 'inseamCm',
    label: 'Длина ноги, см',
    hint: 'По внутреннему шву, необязательно',
    required: false,
  },
]

/** Строковые значения полей формы (пустая строка — поле не заполнено). */
export type FormValues = Record<NumericKey, string>

/** Превращает сохранённые мерки в значения полей формы. */
export function toFormValues(m: Measurements | null): FormValues {
  const values = {} as FormValues
  for (const field of FIELDS) {
    const value = m?.[field.key]
    values[field.key] = value === undefined ? '' : String(value)
  }
  return values
}

/**
 * Проверяет поля формы. Возвращает либо готовые мерки, либо словарь ошибок по полям.
 * Вынесено отдельно от компонента, чтобы проверку можно было тестировать.
 */
export function validateForm(
  gender: BodyGender,
  values: FormValues,
): { measurements: Measurements } | { errors: Partial<Record<NumericKey, string>> } {
  const errors: Partial<Record<NumericKey, string>> = {}
  const parsed: Partial<Record<NumericKey, number>> = {}

  for (const field of FIELDS) {
    const raw = values[field.key].trim().replace(',', '.')
    if (raw === '') {
      if (field.required) errors[field.key] = 'Заполните это поле'
      continue
    }
    const value = Number(raw)
    const { min, max } = MEASUREMENT_LIMITS[field.key]
    if (!Number.isFinite(value) || value < min || value > max) {
      errors[field.key] = `Введите число от ${min} до ${max}`
      continue
    }
    parsed[field.key] = value
  }

  if (Object.keys(errors).length > 0) return { errors }
  return {
    measurements: {
      gender,
      heightCm: parsed.heightCm!,
      weightKg: parsed.weightKg!,
      chestCm: parsed.chestCm!,
      waistCm: parsed.waistCm!,
      hipsCm: parsed.hipsCm!,
      ...(parsed.shouldersCm !== undefined && { shouldersCm: parsed.shouldersCm }),
      ...(parsed.inseamCm !== undefined && { inseamCm: parsed.inseamCm }),
    },
  }
}
