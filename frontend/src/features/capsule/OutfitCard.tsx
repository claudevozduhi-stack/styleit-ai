// Компактная карточка готового образа под капсулой; по клику открывается весь образ.
import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Swatch } from '../../components/Swatch'
import { ITEM_FORMS, formatKzt, pluralRu } from './labels'
import { scorePercent, type Outfit } from './outfits'

/** Карточка-ссылка: название, цвета вещей, цена, оценка и сильные стороны образа. */
export function OutfitCard({ outfit }: { outfit: Outfit }) {
  return (
    <li>
      <Link
        to={`/looks/${outfit.id}`}
        aria-label={`Открыть образ «${outfit.title}»`}
        className="block h-full space-y-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-brand"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{outfit.title}</p>
          <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
            {scorePercent(outfit.score)}%
          </span>
        </div>
        <div className="flex gap-1">
          {outfit.items.map((item) => (
            <Swatch
              key={item.product.id}
              size="sm"
              color={item.product.color_hex}
              label={`${item.product.title}, ${item.product.color_name}`}
            />
          ))}
        </div>
        <p className="text-sm text-neutral-600">
          {pluralRu(outfit.items.length, ITEM_FORMS)} · {formatKzt(outfit.totalKzt)}
        </p>
        {outfit.reasons.length > 0 && (
          <p className="flex items-center gap-1 text-xs text-neutral-500">
            {outfit.fromStylist && <Sparkles className="h-3 w-3" aria-hidden />}
            {outfit.reasons.join(' · ')}
          </p>
        )}
      </Link>
    </li>
  )
}
