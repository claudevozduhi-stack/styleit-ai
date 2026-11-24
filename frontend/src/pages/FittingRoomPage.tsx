// 3D-примерочная: манекен по меркам и вещь из капсулы в любом размере сетки.
import { useQuery } from '@tanstack/react-query'
import { Suspense, lazy, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { FitPanel } from '../features/fitting/FitPanel'
import type { ColorMode } from '../features/fitting/garment'
import { loadCapsule, loadMeasurements } from '../storage/localStore'
import type { SizeOption } from '../types/analysis'
import type { Product } from '../types/catalog'

const FittingScene = lazy(() => import('../features/fitting/FittingScene'))

/** Ищет товар среди вещей сохранённой капсулы. */
function findCapsuleProduct(productId: number): Product | undefined {
  return loadCapsule()
    ?.looks.flatMap((look) => look.items)
    .find((item) => item.product.id === productId)?.product
}

/** Короткое сообщение со ссылкой, когда примерить нечего. */
function Notice({ text, to, link }: { text: string; to: string; link: string }) {
  return (
    <p>
      {text}{' '}
      <Link to={to} className="text-brand underline">
        {link}
      </Link>
      .
    </p>
  )
}

/** Страница примерочной для товара из адреса /fitting/:productId. */
export function FittingRoomPage() {
  const productId = Number(useParams().productId)
  // Мерки и товар читаются один раз: иначе 3D-сетка пересчитывалась бы при каждом рендере.
  const [measurements] = useState(loadMeasurements)
  const [product] = useState(() => findCapsuleProduct(productId))
  const [picked, setPicked] = useState<SizeOption | null>(null)
  const [colorMode, setColorMode] = useState<ColorMode>('fit')

  const query = useQuery({
    queryKey: ['size', productId, measurements],
    queryFn: () => api.recommendSize(productId, measurements!),
    enabled: Boolean(measurements && product),
  })

  if (!measurements) return <Notice text="Сначала" to="/measurements" link="введите мерки" />
  if (!product) {
    return <Notice text="Этой вещи нет в вашей капсуле." to="/capsule" link="Вернуться к капсуле" />
  }
  if (query.isPending) return <p>Считаем посадку…</p>
  if (query.isError) return <p role="alert">Не удалось подобрать размер: {query.error.message}</p>

  const recommendation = query.data
  const selected = picked ?? recommendation.recommended
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Примерка: {product.title}</h1>
        <p className="text-sm text-neutral-600">
          Рекомендуем {recommendation.recommended.size_label}. {recommendation.note}
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
        <div className="h-[420px] overflow-hidden rounded-lg bg-white shadow-sm md:h-[560px]">
          <Suspense fallback={<p className="p-4">Загружаем 3D…</p>}>
            <FittingScene
              measurements={measurements}
              category={product.category}
              colorHex={product.color_hex}
              option={selected}
              colorMode={colorMode}
            />
          </Suspense>
        </div>
        <FitPanel
          options={recommendation.options}
          recommendedLabel={recommendation.recommended.size_label}
          selected={selected}
          onSelect={setPicked}
          colorMode={colorMode}
          onColorModeChange={setColorMode}
        />
      </div>
      <p className="text-xs text-neutral-500">
        Манекен построен только из ваших мерок прямо в браузере. Вращайте его пальцем или мышью.
      </p>
    </section>
  )
}
