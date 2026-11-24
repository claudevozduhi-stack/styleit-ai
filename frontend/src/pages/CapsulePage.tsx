// Результат ИИ-стилиста: образы, размеры, смета и ссылки на магазины.
import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Swatch } from '../components/Swatch'
import { formatKzt } from '../features/capsule/labels'
import { loadCapsule } from '../storage/localStore'
import type { Confidence, LookItem } from '../types/analysis'

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: 'точно подходит',
  medium: 'может сидеть неидеально',
  low: 'плохо подходит',
}

/** Карточка вещи: вместо фото магазина — образец цвета (фото защищены авторским правом). */
function ItemCard({ item }: { item: LookItem }) {
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

/** Страница капсулы. Показывает последнюю собранную капсулу из браузера. */
export function CapsulePage() {
  const capsule = loadCapsule()
  if (!capsule) {
    return (
      <p>
        Капсулы пока нет.{' '}
        <Link to="/style" className="text-brand underline">
          Соберите её
        </Link>
        .
      </p>
    )
  }
  const { estimate } = capsule
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Ваша капсула</h1>
        <p className="text-neutral-700">
          Тип фигуры: <strong>{capsule.body_type_title}</strong>. {capsule.summary}
        </p>
        <p className="text-sm text-neutral-600">{capsule.fit_advice}</p>
      </header>
      {capsule.looks.map((look) => (
        <article key={look.title} className="space-y-3">
          <h2 className="text-lg font-semibold">
            {look.title}{' '}
            <span className="text-sm font-normal text-neutral-500">
              · {formatKzt(look.total_kzt)}
            </span>
          </h2>
          <p className="text-sm text-neutral-700">{look.explanation}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {look.items.map((item) => (
              <ItemCard key={item.product.id} item={item} />
            ))}
          </ul>
        </article>
      ))}
      <aside className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Смета</h2>
        <p>
          {estimate.items_count} вещей на {formatKzt(estimate.total_kzt)} из{' '}
          {formatKzt(estimate.budget_kzt)}.
          {estimate.within_budget
            ? ` Остаётся ${formatKzt(estimate.remaining_kzt)}.`
            : ' Бюджет превышен.'}
        </p>
      </aside>
      <p className="text-xs text-neutral-500">{capsule.disclaimer}</p>
    </section>
  )
}
