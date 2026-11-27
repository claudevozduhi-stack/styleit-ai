// Панель посадки: переключатель размеров, режим раскраски и посадка по зонам.
import type { SizeOption } from '../../types/analysis'
import { FIT_HEX, FIT_LABELS } from './colors'
import type { ColorMode } from './garment'

const ZONE_LABELS = { chest: 'Грудь', waist: 'Талия', hips: 'Бёдра', height: 'Рост' } as const

interface FitPanelProps {
  options: SizeOption[]
  recommendedLabel: string
  selected: SizeOption
  onSelect: (option: SizeOption) => void
  colorMode: ColorMode
  onColorModeChange: (mode: ColorMode) => void
}

interface SizeSwitcherProps {
  options: SizeOption[]
  recommendedLabel: string
  selected: SizeOption
  onSelect: (option: SizeOption) => void
  /** Подпись группы для экранных дикторов (в образе — название вещи). */
  label?: string
}

/** Кнопки размеров: рекомендованный отмечен звёздочкой, соседние сравниваются одним нажатием. */
export function SizeSwitcher(props: SizeSwitcherProps) {
  const { options, recommendedLabel, selected, onSelect, label = 'Размер' } = props
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.size_label === selected.size_label
        return (
          <button
            key={option.size_label}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(option)}
            className={`min-w-12 rounded-md border px-3 py-1.5 text-sm ${
              active ? 'border-brand bg-brand text-white' : 'border-neutral-300 bg-white'
            }`}
          >
            {option.size_label}
            {option.size_label === recommendedLabel && ' ★'}
          </button>
        )
      })}
    </div>
  )
}

interface ColorModeSwitchProps {
  colorMode: ColorMode
  onColorModeChange: (mode: ColorMode) => void
}

/** Переключатель режима: цвет вещи или карта посадки. */
export function ColorModeSwitch({ colorMode, onColorModeChange }: ColorModeSwitchProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={colorMode === 'fit'}
        onChange={(event) => onColorModeChange(event.target.checked ? 'fit' : 'product')}
      />
      Показать посадку цветом
    </label>
  )
}

/** Таблица посадки выбранного размера по зонам сетки. */
function ZoneTable({ selected }: { selected: SizeOption }) {
  return (
    <ul className="space-y-1 text-sm">
      {selected.zones.map((zone) => (
        <li key={zone.zone} className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: FIT_HEX[zone.fit] }}
            aria-hidden
          />
          <span className="w-14 font-medium">{ZONE_LABELS[zone.zone]}</span>
          <span className="text-neutral-600">
            {zone.body_cm} см, размер {zone.size_min_cm}–{zone.size_max_cm} см —{' '}
            <strong className="text-neutral-900">{FIT_LABELS[zone.fit]}</strong>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Панель рядом с 3D-сценой. */
export function FitPanel(props: FitPanelProps) {
  return (
    <div className="space-y-4">
      <SizeSwitcher {...props} />
      <ColorModeSwitch {...props} />
      <ZoneTable selected={props.selected} />
      <p className="text-xs text-neutral-500">
        Синий — свободно, зелёный — в самый раз, красный — тесно. Посадка рассчитана по размерной
        сетке магазина; 3D-вещь построена по тем же цифрам.
      </p>
    </div>
  )
}
