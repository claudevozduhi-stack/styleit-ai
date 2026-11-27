// Форма мерок. Данные проверяются и сохраняются только в браузере.
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { loadMeasurements, saveMeasurements } from '../storage/localStore'
import {
  FIELDS,
  toFormValues,
  validateForm,
  type FormValues,
  type NumericKey,
} from '../features/measurements/form'
import { SizeQuickPick } from '../features/measurements/SizeQuickPick'
import {
  PRESET_KEYS,
  presetFormValues,
  presetHint,
  type PresetKey,
  type SizeLabel,
} from '../features/measurements/sizePresets'
import type { BodyGender } from '../types/body'

/** Является ли поле формы одним из обхватов, которые заполняет быстрый выбор размера. */
function isPresetKey(key: NumericKey): key is PresetKey {
  return (PRESET_KEYS as readonly NumericKey[]).includes(key)
}

/** Страница ввода мерок. */
export function MeasurementsPage() {
  const saved = loadMeasurements()
  const [gender, setGender] = useState<BodyGender>(saved?.gender ?? 'female')
  const [values, setValues] = useState<FormValues>(() => toFormValues(saved))
  const [errors, setErrors] = useState<Partial<Record<NumericKey, string>>>({})
  const [status, setStatus] = useState<string | null>(null)
  const [selectedSize, setSelectedSize] = useState<SizeLabel | null>(null)

  /** Заполняет обхваты типичными значениями размера; остальные поля не трогает. */
  function applySize(nextGender: BodyGender, size: SizeLabel) {
    setValues((current) => ({ ...current, ...presetFormValues(nextGender, size) }))
    setErrors((current) => {
      const rest = { ...current }
      for (const key of PRESET_KEYS) delete rest[key]
      return rest
    })
  }

  function handleSizeSelect(size: SizeLabel) {
    setSelectedSize(size)
    applySize(gender, size)
  }

  // При смене фигуры уже выбранный размер пересчитывается по таблице другого пола.
  function handleGenderChange(nextGender: BodyGender) {
    setGender(nextGender)
    if (selectedSize !== null) applySize(nextGender, selectedSize)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = validateForm(gender, values)
    if ('errors' in result) {
      setErrors(result.errors)
      setStatus(null)
      return
    }
    setErrors({})
    setStatus(
      saveMeasurements(result.measurements)
        ? 'Мерки сохранены на этом устройстве.'
        : 'Браузер запретил сохранение (приватный режим?). Мерки будут работать до закрытия вкладки.',
    )
  }

  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Ваши мерки</h1>
      <p className="text-sm text-neutral-600">Мерки хранятся только в этом браузере.</p>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <SizeQuickPick
          gender={gender}
          selectedSize={selectedSize}
          onGenderChange={handleGenderChange}
          onSizeSelect={handleSizeSelect}
        />
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="text-sm font-medium">{field.label}</span>
            <input
              inputMode="decimal"
              name={field.key}
              value={values[field.key]}
              onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
              aria-invalid={errors[field.key] !== undefined}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
            {field.hint && <span className="text-xs text-neutral-500">{field.hint}</span>}
            {selectedSize !== null && isPresetKey(field.key) && (
              <span className="block text-xs text-brand">
                {presetHint(gender, selectedSize, field.key)}
              </span>
            )}
            {errors[field.key] && (
              <span className="block text-sm text-red-600">{errors[field.key]}</span>
            )}
          </label>
        ))}
        <button type="submit" className="rounded-lg bg-brand px-5 py-3 font-medium text-white">
          Сохранить
        </button>
        {status && (
          <p role="status">
            {status}{' '}
            <Link to="/color-type" className="text-brand underline">
              Дальше: цветотип
            </Link>
          </p>
        )}
      </form>
    </section>
  )
}
