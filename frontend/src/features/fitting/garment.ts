// Одежда как смещение поверхности манекена наружу на запас из размерной сетки.
// Запас в зоне = (середина диапазона размера − мерка тела) + базовый запас фасона.
// Поэтому больший размер на экране сидит свободнее, а меньший — плотнее, как в жизни.
import type { Category } from '../../types/catalog'
import type { BodyZone, Fit, SizeOption } from '../../types/analysis'
import { mixRgb, toRing, type LoftRing, type Rgb } from '../avatar/loft'
import {
  sectionAt,
  sliceSections,
  type BodyModel,
  type Landmarks,
  type Section,
} from '../avatar/sections'
import { FIT_HEX, hexToRgb } from './colors'

/** Режим раскраски: цвет товара или «тепловая карта» посадки. */
export type ColorMode = 'product' | 'fit'

/** Часть вещи, готовая к построению сетки. */
export interface GarmentPart {
  rings: LoftRing[]
  capBottom: boolean
  capTop: boolean
}

/** Запас в одной зоне сетки на высоте этой зоны на манекене. */
export interface ZoneEase {
  zone: BodyZone
  y: number
  easeCm: number
  fit: Fit
}

/** Минимальный зазор: ткань не уходит внутрь тела, тесная зона показывается «в обтяжку». */
export const MIN_CLEARANCE_CM = 0.8
/** Максимальный показываемый запас, чтобы сильно большой размер не превращался в шар. */
export const MAX_EASE_CM = 30

/** Как кроится вещь: базовый запас фасона и границы по высоте. */
interface GarmentSpec {
  baseEaseCm: number
  torso: (l: Landmarks, h: number) => [number, number]
  /** Нижний край рукава; null — без рукавов. */
  sleeveBottom: ((l: Landmarks, h: number) => number) | null
  legs: boolean
  /** Юбка или платье: низ расклёшен до этой высоты. */
  hem?: { y: (l: Landmarks, h: number) => number; flare: number }
}

const LONG_SLEEVE = (l: Landmarks) => l.wristY + 1

const GARMENT_SPECS: Record<Category, GarmentSpec> = {
  tshirt: {
    baseEaseCm: 6,
    torso: (l, h) => [l.hipsY - 0.01 * h, l.neckBaseY],
    sleeveBottom: (l, h) => l.armpitY - 0.06 * h,
    legs: false,
  },
  shirt: {
    baseEaseCm: 8,
    torso: (l, h) => [l.crotchY + 0.01 * h, l.neckBaseY + 0.01 * h],
    sleeveBottom: LONG_SLEEVE,
    legs: false,
  },
  hoodie: {
    baseEaseCm: 12,
    torso: (l, h) => [l.hipsY - 0.03 * h, l.neckTopY],
    sleeveBottom: LONG_SLEEVE,
    legs: false,
  },
  jacket: {
    baseEaseCm: 12,
    torso: (l, h) => [l.crotchY - 0.02 * h, l.neckTopY],
    sleeveBottom: LONG_SLEEVE,
    legs: false,
  },
  trousers: {
    baseEaseCm: 6,
    torso: (l, h) => [l.crotchY, l.waistY + 0.005 * h],
    sleeveBottom: null,
    legs: true,
  },
  jeans: {
    baseEaseCm: 3,
    torso: (l, h) => [l.crotchY, l.waistY + 0.005 * h],
    sleeveBottom: null,
    legs: true,
  },
  skirt: {
    baseEaseCm: 4,
    torso: (l, h) => [l.hipsY, l.waistY + 0.005 * h],
    sleeveBottom: null,
    legs: false,
    hem: { y: (l) => l.kneeY + 2, flare: 0.15 },
  },
  dress: {
    baseEaseCm: 5,
    torso: (l) => [l.hipsY, l.shoulderY],
    sleeveBottom: null,
    legs: false,
    hem: { y: (l) => l.kneeY - 2, flare: 0.2 },
  },
}

const ZONE_LANDMARK: Partial<Record<BodyZone, keyof Landmarks>> = {
  chest: 'chestY',
  waist: 'waistY',
  hips: 'hipsY',
}

/** Запас по зонам выбранного размера, отсортированный по высоте. Рост в одежде не участвует. */
export function zoneEases(
  option: SizeOption,
  landmarks: Landmarks,
  baseEaseCm: number,
): ZoneEase[] {
  return option.zones
    .flatMap((zone) => {
      const key = ZONE_LANDMARK[zone.zone]
      if (!key) return []
      const sizeMiddle = (zone.size_min_cm + zone.size_max_cm) / 2
      const easeCm = sizeMiddle - zone.body_cm + baseEaseCm
      return [{ zone: zone.zone, y: landmarks[key], easeCm, fit: zone.fit }]
    })
    .sort((first, second) => first.y - second.y)
}

/** Запас на высоте y: линейно между зонами, за крайними зонами — как у ближайшей. */
export function easeAt(eases: ZoneEase[], y: number, fallbackCm: number): number {
  const first = eases[0]
  const last = eases[eases.length - 1]
  if (!first || !last) return fallbackCm
  if (y <= first.y) return first.easeCm
  if (y >= last.y) return last.easeCm
  const upperIndex = eases.findIndex((ease) => ease.y >= y)
  const upper = eases[upperIndex] as ZoneEase
  const lower = eases[upperIndex - 1] as ZoneEase
  return lower.easeCm + ((upper.easeCm - lower.easeCm) * (y - lower.y)) / (upper.y - lower.y)
}

/** Ограничивает показываемый запас разумными рамками. */
export function clampEase(easeCm: number): number {
  return Math.min(Math.max(easeCm, MIN_CLEARANCE_CM), MAX_EASE_CM)
}

/** Сечение одежды: обхват тела плюс запас. */
function dress(section: Section, easeCm: number): Section {
  return { ...section, girth: section.girth + clampEase(easeCm) }
}

/** Цвет кольца: товара или посадки ближайшей зоны с мягким переходом к цвету товара. */
function ringColor(y: number, eases: ZoneEase[], mode: ColorMode, product: Rgb, band: number): Rgb {
  if (mode === 'product') return product
  let nearest: ZoneEase | undefined
  for (const ease of eases) {
    if (!nearest || Math.abs(ease.y - y) < Math.abs(nearest.y - y)) nearest = ease
  }
  if (!nearest) return product
  const weight = Math.max(0, 1 - Math.abs(nearest.y - y) / band)
  return mixRgb(product, hexToRgb(FIT_HEX[nearest.fit]), weight)
}

/** Расклёшенный низ юбки или платья от линии бёдер до подола. */
function hemSections(body: BodyModel, spec: GarmentSpec, eases: ZoneEase[]): Section[] {
  const hem = spec.hem
  if (!hem) return []
  const { hipsY } = body.landmarks
  const hipsSection = sectionAt(body.parts.torso.sections, hipsY)
  const hipsGirth = dress(hipsSection, easeAt(eases, hipsY, spec.baseEaseCm)).girth
  const hemY = hem.y(body.landmarks, body.heightCm)
  const steps = 4
  return Array.from({ length: steps }, (_, index) => {
    const t = (steps - index) / steps
    return {
      y: hipsY - (hipsY - hemY) * t,
      girth: hipsGirth * (1 + hem.flare * t),
      depthRatio: 0.8,
      centerX: 0,
    }
  })
}

/** Рукава или штанины: запас фасона плюс доля запаса соседней зоны туловища. */
function limbParts(
  body: BodyModel,
  spec: GarmentSpec,
  eases: ZoneEase[],
  color: Rgb,
): GarmentPart[] {
  const l = body.landmarks
  const h = body.heightCm
  const parts: GarmentPart[] = []
  const make = (sections: Section[], easeFor: (y: number) => number): GarmentPart => ({
    rings: sections.map((section) => toRing(dress(section, easeFor(section.y)), color)),
    capBottom: false,
    capTop: false,
  })
  if (spec.sleeveBottom) {
    const bottom = spec.sleeveBottom(l, h)
    const sleeveEase = spec.baseEaseCm * 0.6 + Math.max(easeAt(eases, l.chestY, 0), 0) * 0.2
    for (const arm of [body.parts.leftArm, body.parts.rightArm]) {
      parts.push(make(sliceSections(arm.sections, bottom, l.shoulderY), () => sleeveEase))
    }
  }
  if (spec.legs) {
    const hipsEase = Math.max(easeAt(eases, l.hipsY, spec.baseEaseCm), 0)
    const legEase = (y: number) =>
      spec.baseEaseCm * 0.6 + hipsEase * 0.4 * ((y - l.ankleY) / (l.crotchY - l.ankleY))
    for (const leg of [body.parts.leftLeg, body.parts.rightLeg]) {
      parts.push(make(sliceSections(leg.sections, l.ankleY, l.crotchY + 0.02 * h), legEase))
    }
  }
  return parts
}

/** Строит вещь выбранного размера на манекене. */
export function buildGarment(
  body: BodyModel,
  category: Category,
  option: SizeOption,
  colorHex: string,
  mode: ColorMode,
): GarmentPart[] {
  const spec = GARMENT_SPECS[category]
  const eases = zoneEases(option, body.landmarks, spec.baseEaseCm)
  const product = hexToRgb(colorHex)
  const band = 0.06 * body.heightCm
  const [bottom, top] = spec.torso(body.landmarks, body.heightCm)
  const torso = [
    ...hemSections(body, spec, eases),
    ...sliceSections(body.parts.torso.sections, bottom, top).map((section) =>
      dress(section, easeAt(eases, section.y, spec.baseEaseCm)),
    ),
  ]
  const torsoPart: GarmentPart = {
    rings: torso.map((section) =>
      toRing(section, ringColor(section.y, eases, mode, product, band)),
    ),
    capBottom: false,
    capTop: false,
  }
  // Рукава и штанины вне зон сетки, поэтому всегда в цвете товара.
  return [torsoPart, ...limbParts(body, spec, eases, product)]
}
