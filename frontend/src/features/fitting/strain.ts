// Тесный размер: насколько натянута ткань в зонах сетки и предупреждение для покупателя.
import type { BodyZone, SizeOption, ZoneFit } from '../../types/analysis'
import type { Landmarks } from '../avatar/sections'

/** Нехватка обхвата, при которой ткань натянута до предела (натяжение 1), см. */
export const STRAIN_FULL_CM = 8
/** Натяжение зоны, которую сетка уже считает тесной, даже если обхват в пределах размера. */
const TIGHT_FLOOR = 0.25

/** Натяжение ткани на высоте зоны: 0 — свободно, 1 — ткань натянута до предела. */
export interface ZoneStrain {
  y: number
  strain: number
}

const ZONE_LANDMARK: Partial<Record<BodyZone, keyof Landmarks>> = {
  chest: 'chestY',
  waist: 'waistY',
  hips: 'hipsY',
}

/** Сколько сантиметров обхвата не хватает самому большому обхвату размера. */
export function shortageCm(zone: ZoneFit): number {
  return Math.max(zone.body_cm - zone.size_max_cm, 0)
}

/** Натяжение по зонам выбранного размера, отсортированное по высоте. */
export function zoneStrains(option: SizeOption, landmarks: Landmarks): ZoneStrain[] {
  return option.zones
    .flatMap((zone) => {
      const key = ZONE_LANDMARK[zone.zone]
      if (!key) return []
      const byShortage = Math.min(shortageCm(zone) / STRAIN_FULL_CM, 1)
      const strain = zone.fit === 'tight' ? Math.max(byShortage, TIGHT_FLOOR) : byShortage
      return [{ y: landmarks[key], strain }]
    })
    .sort((first, second) => first.y - second.y)
}

/** Натяжение на высоте y: линейно между зонами, за крайними зонами — как у ближайшей. */
export function strainAt(strains: ZoneStrain[], y: number): number {
  const first = strains[0]
  const last = strains[strains.length - 1]
  if (!first || !last) return 0
  if (y <= first.y) return first.strain
  if (y >= last.y) return last.strain
  const upperIndex = strains.findIndex((entry) => entry.y >= y)
  const upper = strains[upperIndex] as ZoneStrain
  const lower = strains[upperIndex - 1] as ZoneStrain
  return lower.strain + ((upper.strain - lower.strain) * (y - lower.y)) / (upper.y - lower.y)
}

const ZONE_NAMES: Partial<Record<BodyZone, string>> = {
  chest: 'в груди',
  waist: 'в талии',
  hips: 'в бёдрах',
}

/**
 * Предупреждение о тесном размере: где и на сколько не хватает обхвата и какой размер
 * из предложенных подойдёт лучше. Если размер не тесный — null.
 */
export function tightWarning(selected: SizeOption, options: SizeOption[]): string | null {
  const short = selected.zones
    .filter((zone) => ZONE_NAMES[zone.zone] && (zone.fit === 'tight' || shortageCm(zone) > 0))
    .map((zone) => ({ zone, cm: shortageCm(zone) }))
  if (short.length === 0) return null
  const details = short
    .map(({ zone, cm }) =>
      cm > 0
        ? `${ZONE_NAMES[zone.zone]} не хватает ${Math.round(cm)} см`
        : `тесно ${ZONE_NAMES[zone.zone]}`,
    )
    .join(', ')
  const better = options
    .filter((option) => option.size_order > selected.size_order)
    .sort((first, second) => first.size_order - second.size_order)
    .find((option) => option.zones.every((zone) => zone.fit !== 'tight'))
  const advice = better
    ? `лучше взять ${better.size_label}`
    : 'большего подходящего размера в сетке этого магазина нет'
  return `Размер ${selected.size_label} мал для ваших мерок: ${details}. Ткань будет сильно натянута, ${advice}.`
}
