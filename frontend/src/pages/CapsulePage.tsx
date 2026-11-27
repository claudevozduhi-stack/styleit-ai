// Результат ИИ-стилиста: вещи капсулы, лучшие образы из них, смета и ссылки на магазины.
import { Link } from 'react-router-dom'
import { ItemCard } from '../features/capsule/ItemCard'
import { OutfitCard } from '../features/capsule/OutfitCard'
import { formatKzt } from '../features/capsule/labels'
import { bestOutfits, capsuleItems } from '../features/capsule/outfits'
import { loadCapsule, loadColorType } from '../storage/localStore'
import type { Estimate } from '../types/analysis'

/** Итог сметы: каждая вещь считается один раз. */
function EstimateCard({ estimate }: { estimate: Estimate }) {
  return (
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
  const items = capsuleItems(capsule)
  // Палитра цветотипа повышает оценку образов в «ваших» цветах; без неё оценка нейтральна.
  const outfits = bestOutfits(capsule, loadColorType()?.palette_hex ?? [])
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Ваша капсула</h1>
        <p className="text-neutral-700">
          Тип фигуры: <strong>{capsule.body_type_title}</strong>. {capsule.summary}
        </p>
        <p className="text-sm text-neutral-600">{capsule.fit_advice}</p>
      </header>
      <section className="space-y-3" aria-labelledby="capsule-items">
        <h2 id="capsule-items" className="text-lg font-semibold">
          Вещи капсулы
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <ItemCard key={item.product.id} item={item} />
          ))}
        </ul>
      </section>
      <section className="space-y-3" aria-labelledby="best-outfits">
        <h2 id="best-outfits" className="text-lg font-semibold">
          Лучшие образы
        </h2>
        <p className="text-sm text-neutral-600">
          Сочетания из вещей капсулы: образы стилиста и подборки по размеру, цвету и стилю. Нажмите
          на образ, чтобы увидеть его целиком на манекене.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {outfits.map((outfit) => (
            <OutfitCard key={outfit.id} outfit={outfit} />
          ))}
        </ul>
      </section>
      <EstimateCard estimate={capsule.estimate} />
      <p className="text-xs text-neutral-500">{capsule.disclaimer}</p>
    </section>
  )
}
