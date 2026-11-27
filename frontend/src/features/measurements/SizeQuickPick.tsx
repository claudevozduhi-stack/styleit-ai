// Блок «Быстрый старт»: выбор фигуры и привычного размера одежды над полями мерок.
import type { BodyGender } from '../../types/body'
import { SIZE_LABELS, SIZE_PRESETS, type SizeLabel } from './sizePresets'

interface SizeQuickPickProps {
  gender: BodyGender
  selectedSize: SizeLabel | null
  onGenderChange: (gender: BodyGender) => void
  onSizeSelect: (size: SizeLabel) => void
}

/** Переключатель фигуры и кнопки размеров XS–XXL с российским эквивалентом. */
export function SizeQuickPick({
  gender,
  selectedSize,
  onGenderChange,
  onSizeSelect,
}: SizeQuickPickProps) {
  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <fieldset className="flex gap-4">
        <legend className="mb-1 text-sm font-medium">Фигура</legend>
        {(['female', 'male'] as const).map((option) => (
          <label key={option} className="flex items-center gap-2">
            <input
              type="radio"
              name="gender"
              value={option}
              checked={gender === option}
              onChange={() => onGenderChange(option)}
            />
            {option === 'female' ? 'Женская' : 'Мужская'}
          </label>
        ))}
      </fieldset>
      <div role="group" aria-labelledby="size-quick-pick-title">
        <p id="size-quick-pick-title" className="text-sm font-medium">
          Ваш обычный размер
        </p>
        <p className="mb-2 text-xs text-neutral-500">
          Заполним обхваты типичными значениями, их можно поправить.
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {SIZE_LABELS.map((size) => (
            <button
              key={size}
              type="button"
              aria-pressed={selectedSize === size}
              onClick={() => onSizeSelect(size)}
              className={`rounded-lg border px-2 py-2 text-center ${
                selectedSize === size
                  ? 'border-brand bg-brand text-white'
                  : 'border-neutral-300 bg-white'
              }`}
            >
              <span className="block font-medium">{size}</span>
              <span className="block text-xs opacity-80">
                RU {SIZE_PRESETS[gender][size].ruLabel}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
