// Выбор стиля, повода и бюджета и запуск ИИ-стилиста.
import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, toApiMeasurements } from '../api/client'
import { OCCASION_LABELS, STYLE_LABELS } from '../features/capsule/labels'
import { getClientId, loadColorType, loadMeasurements, saveCapsule } from '../storage/localStore'
import type { Occasion } from '../types/analysis'
import type { Style } from '../types/catalog'

const BUDGET_MIN = 5_000
const BUDGET_MAX = 2_000_000

/** Страница параметров капсулы. Без мерок отправляет заполнить их. */
export function StylePage() {
  const navigate = useNavigate()
  const measurements = loadMeasurements()
  const colorType = loadColorType()
  const [style, setStyle] = useState<Style>('casual')
  const [occasion, setOccasion] = useState<Occasion>('everyday')
  const [budget, setBudget] = useState('60000')
  const [budgetError, setBudgetError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (budgetKzt: number) =>
      api.capsule(
        {
          measurements: toApiMeasurements(measurements!),
          style,
          occasion,
          budget_kzt: budgetKzt,
          palette_hex: colorType?.palette_hex ?? [],
        },
        getClientId(),
      ),
    onSuccess: (capsule) => {
      saveCapsule(capsule)
      navigate('/capsule')
    },
  })

  if (!measurements) {
    return (
      <p>
        Сначала{' '}
        <Link to="/measurements" className="text-brand underline">
          введите мерки
        </Link>
        .
      </p>
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = Number(budget.replace(/\s/g, ''))
    if (!Number.isInteger(value) || value < BUDGET_MIN || value > BUDGET_MAX) {
      setBudgetError(`Бюджет — целое число от ${BUDGET_MIN} до ${BUDGET_MAX} ₸`)
      return
    }
    setBudgetError(null)
    mutation.mutate(value)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">Стиль, повод и бюджет</h1>
      {!colorType && (
        <p className="text-sm text-neutral-600">
          Совет:{' '}
          <Link to="/color-type" className="text-brand underline">
            определите цветотип
          </Link>
          , чтобы ИИ подобрал подходящие вам цвета.
        </p>
      )}
      <label className="block">
        <span className="text-sm font-medium">Стиль</span>
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value as Style)}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
        >
          {Object.entries(STYLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Повод</span>
        <select
          value={occasion}
          onChange={(e) => setOccasion(e.target.value as Occasion)}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
        >
          {Object.entries(OCCASION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Бюджет на капсулу, ₸</span>
        <input
          inputMode="numeric"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          aria-invalid={budgetError !== null}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
        {budgetError && <span className="block text-sm text-red-600">{budgetError}</span>}
      </label>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-lg bg-brand px-5 py-3 font-medium text-white disabled:opacity-60"
      >
        {mutation.isPending ? 'ИИ подбирает образы…' : 'Собрать капсулу'}
      </button>
      {mutation.isError && (
        <p role="alert" className="text-red-600">
          {mutation.error.message}
        </p>
      )}
    </form>
  )
}
