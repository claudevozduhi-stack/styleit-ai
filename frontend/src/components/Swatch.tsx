// Кружок цвета: используется в анкете цветотипа, палитре и вместо фото товара.

interface SwatchProps {
  color: string
  label: string
  selected?: boolean
  onClick?: () => void
  size?: 'sm' | 'md'
}

/** Цветной кружок; если передан onClick — кнопка выбора. */
export function Swatch({ color, label, selected = false, onClick, size = 'md' }: SwatchProps) {
  const dimension = size === 'sm' ? 'h-6 w-6' : 'h-10 w-10'
  const ring = selected ? 'ring-2 ring-brand ring-offset-2' : 'ring-1 ring-neutral-300'
  const style = { backgroundColor: color }
  if (!onClick) {
    return (
      <span
        title={label}
        aria-label={label}
        className={`inline-block rounded-full ${dimension} ${ring}`}
        style={style}
      />
    )
  }
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full ${dimension} ${ring}`}
      style={style}
    />
  )
}
