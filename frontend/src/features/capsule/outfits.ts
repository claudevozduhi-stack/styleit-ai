// Лучшие образы из вещей капсулы: образы стилиста плюс все допустимые сочетания,
// которые код собирает сам, с оценкой по размеру, цвету, палитре и стилю.
// Всё считается в браузере; на сервер и в ИИ ничего не отправляется.
import type { Capsule, Confidence, LookItem } from '../../types/analysis'
import type { Category, Style } from '../../types/catalog'
import { outfitHarmony, paletteCloseness } from './colorHarmony'
import { CATEGORY_LABELS } from './labels'

/** Место вещи в образе; совпадает с CATEGORY_SLOT бэкенда (app/core/vocab.py). */
export type Slot = 'top' | 'bottom' | 'dress' | 'outer'

export const CATEGORY_SLOT: Record<Category, Slot> = {
  tshirt: 'top',
  shirt: 'top',
  hoodie: 'top',
  jacket: 'outer',
  trousers: 'bottom',
  jeans: 'bottom',
  skirt: 'bottom',
  dress: 'dress',
}

/** Порядок слоёв снизу вверх: низ или платье, затем верх, затем верхняя одежда. */
export const SLOT_LAYER: Record<Slot, number> = { bottom: 0, dress: 0, top: 1, outer: 2 }

/** Готовый образ для показа под капсулой. */
export interface Outfit {
  /** ID товаров по возрастанию через «-»: адрес страницы образа /looks/:id. */
  id: string
  title: string
  explanation: string
  items: LookItem[]
  totalKzt: number
  /** Итоговая оценка 0..1. */
  score: number
  /** Образ предложил ИИ-стилист (а не собрал код). */
  fromStylist: boolean
  /** Короткие причины высокой оценки для карточки. */
  reasons: string[]
}

/** Сколько лучших образов показывать под капсулой. */
export const BEST_OUTFITS_LIMIT = 6

/** Веса частей оценки; в сумме 1. */
const WEIGHTS = { size: 0.35, harmony: 0.25, palette: 0.2, style: 0.1, stylist: 0.1 } as const

const CONFIDENCE_SCORE: Record<Confidence, number> = { high: 1, medium: 0.5, low: 0 }

/** Порог, начиная с которого часть оценки попадает в причины на карточке. */
const REASON_THRESHOLD = 0.75

/** Все разные вещи капсулы, по одному разу, в порядке появления в образах. */
export function capsuleItems(capsule: Capsule): LookItem[] {
  const unique = new Map<number, LookItem>()
  for (const look of capsule.looks) {
    for (const item of look.items) {
      if (!unique.has(item.product.id)) unique.set(item.product.id, item)
    }
  }
  return [...unique.values()]
}

/** ID образа: одинаковый для одного набора вещей независимо от порядка. */
export function outfitId(items: LookItem[]): string {
  return items
    .map((item) => item.product.id)
    .sort((first, second) => first - second)
    .join('-')
}

/** Состав допустим: верх + низ или одно платье, плюс не больше одной верхней одежды. */
export function isValidOutfit(items: LookItem[]): boolean {
  const count = (slot: Slot) =>
    items.filter((item) => CATEGORY_SLOT[item.product.category] === slot).length
  if (count('outer') > 1) return false
  const pair = count('top') === 1 && count('bottom') === 1 && count('dress') === 0
  const dress = count('dress') === 1 && count('top') === 0 && count('bottom') === 0
  return pair || dress
}

/** Все допустимые сочетания вещей: (верх × низ или платье) × (без куртки или с курткой). */
export function combineOutfits(items: LookItem[]): LookItem[][] {
  const bySlot = (slot: Slot) =>
    items.filter((item) => CATEGORY_SLOT[item.product.category] === slot)
  const bases: LookItem[][] = [
    ...bySlot('top').flatMap((top) => bySlot('bottom').map((bottom) => [bottom, top])),
    ...bySlot('dress').map((dress) => [dress]),
  ]
  const outerOptions: (LookItem | null)[] = [null, ...bySlot('outer')]
  return bases.flatMap((base) => outerOptions.map((outer) => (outer ? [...base, outer] : base)))
}

/** Доля стилей, общих для всех вещей: 1 — у всех вещей есть общий стиль. */
function styleUnity(items: LookItem[]): number {
  const [first, ...rest] = items
  if (!first) return 0
  const shared = first.product.style_tags.filter((style: Style) =>
    rest.every((item) => item.product.style_tags.includes(style)),
  )
  return shared.length > 0 ? 1 : 0
}

/** Части оценки образа, каждая 0..1. */
export interface OutfitScoreParts {
  size: number
  harmony: number
  palette: number
  style: number
  stylist: number
}

/** Считает части оценки. Без палитры цветотипа её часть нейтральна (0.5). */
export function scoreParts(
  items: LookItem[],
  palette: string[],
  fromStylist: boolean,
): OutfitScoreParts {
  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length
  const colors = items.map((item) => item.product.color_hex)
  return {
    size: average(items.map((item) => CONFIDENCE_SCORE[item.size_confidence])),
    harmony: outfitHarmony(colors),
    palette:
      palette.length > 0 ? average(colors.map((hex) => paletteCloseness(hex, palette))) : 0.5,
    style: styleUnity(items),
    stylist: fromStylist ? 1 : 0,
  }
}

/** Взвешенная сумма частей оценки. */
export function totalScore(parts: OutfitScoreParts): number {
  return (Object.keys(WEIGHTS) as (keyof OutfitScoreParts)[]).reduce(
    (sum, key) => sum + WEIGHTS[key] * parts[key],
    0,
  )
}

/** Причины для карточки: только сильные стороны образа. */
function reasonsFor(parts: OutfitScoreParts, hasPalette: boolean): string[] {
  const reasons: string[] = []
  if (parts.stylist === 1) reasons.push('Собран ИИ-стилистом')
  if (parts.size >= REASON_THRESHOLD) reasons.push('Размеры подходят')
  if (parts.harmony >= REASON_THRESHOLD) reasons.push('Цвета сочетаются')
  if (hasPalette && parts.palette >= REASON_THRESHOLD) reasons.push('В вашей палитре')
  if (parts.style === 1) reasons.push('Единый стиль')
  return reasons
}

/** Порядок вещей в названии образа: верх или платье, низ, верхняя одежда. */
const TITLE_ORDER: Record<Slot, number> = { top: 0, dress: 0, bottom: 1, outer: 2 }

/** Название собранного кодом образа из категорий вещей: «Футболка, джинсы и куртка». */
export function outfitTitle(items: LookItem[]): string {
  const names = [...items]
    .sort(
      (first, second) =>
        TITLE_ORDER[CATEGORY_SLOT[first.product.category]] -
        TITLE_ORDER[CATEGORY_SLOT[second.product.category]],
    )
    .map((item, index) => {
      const label = CATEGORY_LABELS[item.product.category]
      return index === 0 ? label : label.toLowerCase()
    })
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} и ${names[names.length - 1] ?? ''}`
}

/** Пояснение к образу, собранному кодом: причины оценки или нейтральная фраза. */
function generatedExplanation(reasons: string[]): string {
  const base = 'Сочетание из вещей вашей капсулы.'
  return reasons.length > 0 ? `${base} ${reasons.join('. ')}.` : base
}

/** Слой вещи на манекене. */
export function layerOf(item: LookItem): number {
  return SLOT_LAYER[CATEGORY_SLOT[item.product.category]]
}

/** Строит образ с оценкой. */
function makeOutfit(
  items: LookItem[],
  palette: string[],
  stylistLook: { title: string; explanation: string } | null,
): Outfit {
  const parts = scoreParts(items, palette, stylistLook !== null)
  const reasons = reasonsFor(parts, palette.length > 0)
  return {
    id: outfitId(items),
    title: stylistLook?.title ?? outfitTitle(items),
    explanation: stylistLook?.explanation ?? generatedExplanation(reasons),
    items: [...items].sort((first, second) => layerOf(first) - layerOf(second)),
    totalKzt: items.reduce((sum, item) => sum + item.product.price_kzt, 0),
    score: totalScore(parts),
    fromStylist: stylistLook !== null,
    reasons,
  }
}

/**
 * Все образы капсулы с оценкой, лучшие первыми: образы стилиста и сочетания кода
 * без повторов одного и того же набора вещей.
 */
export function rankOutfits(capsule: Capsule, palette: string[]): Outfit[] {
  const outfits = new Map<string, Outfit>()
  for (const look of capsule.looks) {
    if (!isValidOutfit(look.items)) continue
    const outfit = makeOutfit(look.items, palette, look)
    outfits.set(outfit.id, outfit)
  }
  for (const items of combineOutfits(capsuleItems(capsule))) {
    const id = outfitId(items)
    if (!outfits.has(id)) outfits.set(id, makeOutfit(items, palette, null))
  }
  return [...outfits.values()].sort(
    (first, second) => second.score - first.score || first.totalKzt - second.totalKzt,
  )
}

/** Лучшие образы для показа под капсулой. */
export function bestOutfits(
  capsule: Capsule,
  palette: string[],
  limit = BEST_OUTFITS_LIMIT,
): Outfit[] {
  return rankOutfits(capsule, palette).slice(0, limit)
}

/** Находит образ по адресу /looks/:id среди всех сочетаний капсулы. */
export function findOutfit(capsule: Capsule, palette: string[], id: string): Outfit | undefined {
  return rankOutfits(capsule, palette).find((outfit) => outfit.id === id)
}

/** Оценка образа в процентах для подписи на карточке. */
export function scorePercent(score: number): number {
  return Math.round(score * 100)
}
