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
import type { BodyGender } from '../types/body'

/** Страница ввода мерок. */
export function MeasurementsPage() {
  const saved = loadMeasurements()
  const [gender, setGender] = useState<BodyGender>(saved?.gender ?? 'female')
  const [values, setValues] = useState<FormValues>(() => toFormValues(saved))
  const [errors, setErrors] = useState<Partial<Record<NumericKey, string>>>({})
  const [status, setStatus] = useState<string | null>(null)

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
        <fieldset className="flex gap-4">
          <legend className="mb-1 text-sm font-medium">Фигура</legend>
          {(['female', 'male'] as const).map((option) => (
            <label key={option} className="flex items-center gap-2">
              <input
                type="radio"
                name="gender"
                value={option}
                checked={gender === option}
                onChange={() => setGender(option)}
              />
              {option === 'female' ? 'Женская' : 'Мужская'}
            </label>
          ))}
        </fieldset>
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
