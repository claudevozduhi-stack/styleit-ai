// Русские подписи значений справочников и форматирование цены.
import type { Occasion, Undertone } from '../../types/analysis'
import type { Style } from '../../types/catalog'

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
