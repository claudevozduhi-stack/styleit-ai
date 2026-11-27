// Карточка вещи капсулы: цвет вместо фото, размер, цена и ссылки на примерку и магазин.
import { Box, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Swatch } from '../../components/Swatch'
import type { Confidence, LookItem } from '../../types/analysis'
import { formatKzt } from './labels'

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: 'точно подходит',
  medium: 'может сидеть неидеально',
  low: 'плохо подходит',
}

/** Карточка вещи: вместо фото магазина — образец цвета (фото защищены авторским правом). */
export function ItemCard({ item }: { item: LookItem }) {
  const { product } = item
  return (
    <li className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      <Swatch color={product.color_hex} label={product.color_name} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{product.title}</p>
        <p className="text-sm text-neutral-600">
          {product.brand} · {product.store} · {product.color_name}
        </p>
        <p className="text-sm">
          Размер <strong>{item.recommended_size}</strong> —{' '}
          {CONFIDENCE_LABELS[item.size_confidence]}
        </p>
        {item.size_confidence !== 'high' && (
          <p className="text-xs text-neutral-500">{item.size_note}</p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold">{formatKzt(product.price_kzt)}</span>
          <Link
            to={`/fitting/${product.id}`}
            className="inline-flex items-center gap-1 text-brand underline"
          >
            Примерить в 3D <Box className="h-3 w-3" aria-hidden />
          </Link>
          <a
            href={product.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand underline"
          >
            В магазин <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
      </div>
    </li>
  )
}
