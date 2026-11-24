// Анкета цветотипа: подтон и цвета кожи, волос, глаз выбираются из образцов.
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Swatch } from '../components/Swatch'
import { UNDERTONE_LABELS } from '../features/capsule/labels'
import { loadColorType, saveColorType } from '../storage/localStore'
import type { ColorAnalysis, Undertone } from '../types/analysis'

interface Option {
  hex: string
  label: string
}

const SKIN: Option[] = [
  { hex: '#f6e0d3', label: 'Очень светлая' },
  { hex: '#f1d3c2', label: 'Светлая' },
  { hex: '#e3b99a', label: 'Светло-средняя' },
  { hex: '#c68c63', label: 'Средняя' },
  { hex: '#9a6440', label: 'Смуглая' },
  { hex: '#5e3b26', label: 'Тёмная' },
]
const HAIR: Option[] = [
  { hex: '#efd9a7', label: 'Светлый блонд' },
  { hex: '#d8b26e', label: 'Блонд' },
  { hex: '#a8774a', label: 'Русый' },
  { hex: '#b5532d', label: 'Рыжий' },
  { hex: '#5a3a22', label: 'Каштановый' },
  { hex: '#2e211a', label: 'Тёмно-каштановый' },
  { hex: '#1b1612', label: 'Чёрный' },
  { hex: '#bfbfbf', label: 'Седой' },
]
const EYES: Option[] = [
  { hex: '#4a6b8a', label: 'Голубые / серые' },
  { hex: '#5f7a4a', label: 'Зелёные' },
  { hex: '#8a6a3a', label: 'Ореховые' },
  { hex: '#5a3a22', label: 'Карие' },
  { hex: '#2b1d14', label: 'Тёмно-карие' },
]
const UNDERTONES: Undertone[] = ['warm', 'cool', 'neutral']

/** Ряд образцов цвета с выбором одного. */
function SwatchRow(props: {
  title: string
  options: Option[]
  value: string
  onChange: (hex: string) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{props.title}</legend>
      <div className="flex flex-wrap gap-3">
        {props.options.map((option) => (
          <Swatch
            key={option.hex}
            color={option.hex}
            label={option.label}
            selected={props.value === option.hex}
            onClick={() => props.onChange(option.hex)}
          />
        ))}
      </div>
    </fieldset>
  )
}

/** Страница цветотипа. Фото не требуется. */
export function ColorTypePage() {
  const [undertone, setUndertone] = useState<Undertone>('neutral')
  const [skin, setSkin] = useState(SKIN[1].hex)
  const [hair, setHair] = useState(HAIR[4].hex)
  const [eyes, setEyes] = useState(EYES[3].hex)
  const [result, setResult] = useState<ColorAnalysis | null>(() => loadColorType())

  const mutation = useMutation({
    mutationFn: () => api.colorType({ undertone, skin_hex: skin, hair_hex: hair, eye_hex: eyes }),
    onSuccess: (data) => {
      saveColorType(data)
      setResult(data)
    },
  })

  return (
    <section className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">Цветотип</h1>
      <p className="text-sm text-neutral-600">
        Выберите ближайшие оттенки. Фото не нужно, ответы хранятся только в этом браузере.
      </p>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">
          Какого цвета вены на запястье при дневном свете?
        </legend>
        {UNDERTONES.map((option) => (
          <label key={option} className="flex items-center gap-2">
            <input
              type="radio"
              name="undertone"
              checked={undertone === option}
              onChange={() => setUndertone(option)}
            />
            {UNDERTONE_LABELS[option]}
          </label>
        ))}
      </fieldset>
      <SwatchRow title="Кожа" options={SKIN} value={skin} onChange={setSkin} />
      <SwatchRow title="Волосы (натуральный цвет)" options={HAIR} value={hair} onChange={setHair} />
      <SwatchRow title="Глаза" options={EYES} value={eyes} onChange={setEyes} />
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="rounded-lg bg-brand px-5 py-3 font-medium text-white disabled:opacity-60"
      >
        {mutation.isPending ? 'Определяем…' : 'Определить цветотип'}
      </button>
      {mutation.isError && (
        <p role="alert" className="text-red-600">
          {mutation.error.message}
        </p>
      )}
      {result && (
        <div className="space-y-3 rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-xl font-semibold">{result.title}</h2>
          <p className="text-neutral-700">{result.explanation}</p>
          <div className="flex flex-wrap gap-2" aria-label="Ваша палитра">
            {result.palette_hex.map((hex) => (
              <Swatch key={hex} color={hex} label={hex} size="sm" />
            ))}
          </div>
          <Link
            to="/style"
            className="inline-block rounded-lg bg-brand px-5 py-3 font-medium text-white"
          >
            Дальше: стиль и бюджет
          </Link>
        </div>
      )}
    </section>
  )
}
