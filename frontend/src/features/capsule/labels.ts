// Русские подписи значений справочников и форматирование цены.
import type { Occasion, Undertone } from '../../types/analysis'
import type { Category, Style } from '../../types/catalog'

export const STYLE_LABELS: Record<Style, string> = {
  casual: 'Повседневный',
  office: 'Деловой',
  sport: 'Спортивный',
  evening: 'Вечерний',
  street: 'Уличный',
}

export const OCCASION_LABELS: Record<Occasion, string> = {
  everyday: 'На каждый день',
  work: 'Работа',
  study: 'Учёба',
  date: 'Свидание',
  party: 'Вечеринка',
  travel: 'Путешествие',
}

export const UNDERTONE_LABELS: Record<Undertone, string> = {
  warm: 'Вены зеленоватые (тёплый)',
  cool: 'Вены синие или фиолетовые (холодный)',
  neutral: 'Не понятно (нейтральный)',
}

/** Формат цены в тенге: 12 990 ₸. */
export function formatKzt(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₸`
}

/** Русские названия категорий одежды. */
export const CATEGORY_LABELS: Record<Category, string> = {
  tshirt: 'Футболка',
  shirt: 'Рубашка',
  hoodie: 'Худи',
  jacket: 'Куртка',
  trousers: 'Брюки',
  jeans: 'Джинсы',
  skirt: 'Юбка',
  dress: 'Платье',
}

/** Число с русским склонением: 1 вещь, 2 вещи, 5 вещей. */
export function pluralRu(count: number, forms: readonly [string, string, string]): string {
  const lastTwo = Math.abs(count) % 100
  const last = lastTwo % 10
  let form = forms[2]
  if (lastTwo < 11 || lastTwo > 14) {
    if (last === 1) form = forms[0]
    else if (last >= 2 && last <= 4) form = forms[1]
  }
  return `${count} ${form}`
}

export const ITEM_FORMS = ['вещь', 'вещи', 'вещей'] as const
