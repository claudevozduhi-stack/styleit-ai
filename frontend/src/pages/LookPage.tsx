// Страница образа: все вещи образа сразу на манекене по меркам, размеры и сумма.
import { useQueries } from '@tanstack/react-query'
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { ItemCard } from '../features/capsule/ItemCard'
import { formatKzt } from '../features/capsule/labels'
import { findOutfit, type Outfit } from '../features/capsule/outfits'
import { ColorModeSwitch, SizeSwitcher } from '../features/fitting/FitPanel'
import type { ColorMode } from '../features/fitting/garment'
import type { SceneGarment } from '../features/fitting/layers'
import { loadCapsule, loadColorType, loadMeasurements } from '../storage/localStore'
import type { SizeOption, SizeRecommendation } from '../types/analysis'
import type { Measurements } from '../types/body'

const FittingScene = lazy(() => import('../features/fitting/FittingScene'))

/** Ищет образ из адреса среди сочетаний сохранённой капсулы. */
function loadOutfit(id: string): Outfit | undefined {
  const capsule = loadCapsule()
  if (!capsule) return undefined
  return findOutfit(capsule, loadColorType()?.palette_hex ?? [], id)
}

/** Короткое сообщение со ссылкой, когда показать нечего. */
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

/** Рекомендации размера для каждой вещи образа; ошибка любой — ошибка страницы. */
function useOutfitSizes(outfit: Outfit | undefined, measurements: Measurements | null) {
  return useQueries({
    queries: (outfit?.items ?? []).map((item) => ({
      queryKey: ['size', item.product.id, measurements],
      queryFn: () => api.recommendSize(item.product.id, measurements as Measurements),
      enabled: Boolean(measurements),
    })),
    combine: (results) => ({
      data: results.every((result) => result.data)
        ? results.map((result) => result.data as SizeRecommendation)
        : null,
      error: results.find((result) => result.error)?.error ?? null,
    }),
  })
}

/** Страница образа /looks/:outfitId. */
export function LookPage() {
  const outfitId = useParams().outfitId ?? ''
  // Данные читаются один раз: иначе 3D-сетка пересчитывалась бы при каждом рендере.
  const [measurements] = useState(loadMeasurements)
  const [outfit] = useState(() => loadOutfit(outfitId))
  const [picked, setPicked] = useState<Record<number, SizeOption>>({})
  const [colorMode, setColorMode] = useState<ColorMode>('product')
  const sizes = useOutfitSizes(outfit, measurements)
  // Переход с карточки внизу капсулы: открываем образ сверху, с манекена.
  useEffect(() => window.scrollTo(0, 0), [outfitId])

  // Вещи уже отсортированы по слоям: низ или платье, верх, верхняя одежда.
  const garments = useMemo<SceneGarment[]>(() => {
    if (!outfit || !sizes.data) return []
    const recommendations = sizes.data
    return outfit.items.map((item, index) => ({
      category: item.product.category,
      colorHex: item.product.color_hex,
      option: picked[item.product.id] ?? (recommendations[index] as SizeRecommendation).recommended,
    }))
  }, [outfit, sizes.data, picked])

  if (!measurements) return <Notice text="Сначала" to="/measurements" link="введите мерки" />
  if (!outfit) {
    return (
      <Notice text="Такого образа нет в вашей капсуле." to="/capsule" link="Вернуться к капсуле" />
    )
  }
  if (sizes.error) {
    return <p role="alert">Не удалось подобрать размеры: {sizes.error.message}</p>
  }
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <Link to="/capsule" className="text-sm text-brand underline">
          ← К капсуле
        </Link>
        <h1 className="text-2xl font-bold">{outfit.title}</h1>
        <p className="text-sm text-neutral-700">{outfit.explanation}</p>
        <p className="text-sm">
          Весь образ: <strong>{formatKzt(outfit.totalKzt)}</strong>
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
        <div className="h-[420px] overflow-hidden rounded-lg bg-white shadow-sm md:h-[560px]">
          {sizes.data ? (
            <Suspense fallback={<p className="p-4">Загружаем 3D…</p>}>
              <FittingScene measurements={measurements} garments={garments} colorMode={colorMode} />
            </Suspense>
          ) : (
            <p className="p-4">Считаем посадку…</p>
          )}
        </div>
        <div className="space-y-4">
          <ColorModeSwitch colorMode={colorMode} onColorModeChange={setColorMode} />
          {sizes.data &&
            outfit.items.map((item, index) => {
              const recommendation = sizes.data?.[index] as SizeRecommendation
              return (
                <div key={item.product.id} className="space-y-1">
                  <p className="text-sm font-medium">{item.product.title}</p>
                  <SizeSwitcher
                    label={`Размер: ${item.product.title}`}
                    options={recommendation.options}
                    recommendedLabel={recommendation.recommended.size_label}
                    selected={garments[index]?.option ?? recommendation.recommended}
                    onSelect={(option) =>
                      setPicked((current) => ({ ...current, [item.product.id]: option }))
                    }
                  />
                </div>
              )
            })}
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {outfit.items.map((item) => (
          <ItemCard key={item.product.id} item={item} />
        ))}
      </ul>
      <p className="text-xs text-neutral-500">
        Манекен построен только из ваших мерок прямо в браузере. Вещи надеты слоями: низ, верх,
        верхняя одежда. Вращайте манекен пальцем или мышью.
      </p>
    </section>
  )
}
