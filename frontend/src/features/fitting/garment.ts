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

/** Вид детали: туловище, рукав или штанина. Нужен, чтобы надевать вещи слоями. */
export type GarmentPartKind = 'torso' | 'sleeve' | 'leg'

/** Часть вещи, готовая к построению сетки. */
export interface GarmentPart {
  kind: GarmentPartKind
  rings: LoftRing[]
  capBottom: boolean
  capTop: boolean
  /** Число складок по окружности детали. */
  foldCount: number
  /** Толщина подгиба на открытых краях, см (0 — без подгиба). */
  edgeThickness: number
  /** Купол над верхом детали (у рукава — оката над плечом), в долях радиуса; 0 — нет. */
  domeTop: number
  /** Купол под низом детали (у брюк — шаговый шов между ног), в долях радиуса; 0 — нет. */
  domeBottom: number
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

/** Низ туловищной детали брюк над шагом (доля роста): ниже ткань идёт штанинами. */
const CROTCH_RISE = 0.015

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
    torso: (l, h) => [l.crotchY + CROTCH_RISE * h, l.waistY + 0.005 * h],
    sleeveBottom: null,
    legs: true,
  },
  jeans: {
    baseEaseCm: 3,
    torso: (l, h) => [l.crotchY + CROTCH_RISE * h, l.waistY + 0.005 * h],
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

/** Толщина подгиба ткани на подоле, манжетах и горловине, см. */
const FABRIC_EDGE_CM = 0.6

/** Дополнительный обхват подола юбки и платья, чтобы ткань висела вокруг ног, см. */
const SKIRT_LEG_ROOM_CM = 6

/** Глубина складок растёт с запасом: в обтяжку ткань гладкая, свободная вещь собирается в складки. */
const FOLD_PER_EASE_CM = 0.09
const MAX_FOLD_DEPTH_CM = 1.5
/** Складки по окружности: на туловище, на рукавах и штанинах, у юбок и платьев. */
const FOLDS = { torso: 10, limb: 6, skirt: 14 } as const

/** Глубина складок для запаса easeCm: до 2 см запаса складок нет. */
export function foldDepthFor(easeCm: number): number {
  return Math.min(Math.max((easeCm - 2) * FOLD_PER_EASE_CM, 0), MAX_FOLD_DEPTH_CM)
}

/** Сечение одежды: обхват тела плюс запас; ткань повторяет выпуклости тела. */
function dress(section: Section, easeCm: number): Section {
  return { ...section, girth: section.girth + clampEase(easeCm) }
}

/** Кольцо одежды: сечение с запасом, цвет и складки по этому запасу. */
function dressRing(section: Section, easeCm: number, color: Rgb, foldBoost = 1): LoftRing {
  return toRing(dress(section, easeCm), color, foldDepthFor(easeCm) * foldBoost)
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

/**
 * Расклёшенный низ юбки или платья от линии бёдер до подола.
 * Чем ниже кольцо и шире клёш, тем глубже складки — ткань свободно висит.
 */
function hemRings(
  body: BodyModel,
  spec: GarmentSpec,
  eases: ZoneEase[],
  color: (y: number) => Rgb,
): LoftRing[] {
  const hem = spec.hem
  if (!hem) return []
  const { hipsY } = body.landmarks
  const hipsEase = easeAt(eases, hipsY, spec.baseEaseCm)
  const hipsGirth = dress(sectionAt(body.parts.torso.sections, hipsY), hipsEase).girth
  const hemY = hem.y(body.landmarks, body.heightCm)
  const steps = 4
  return Array.from({ length: steps }, (_, index) => {
    const t = (steps - index) / steps
    const y = hipsY - (hipsY - hemY) * t
    const section: Section = {
      y,
      // Запас под ноги: клёш не должен касаться бёдер при шаге.
      girth: hipsGirth * (1 + hem.flare * t) + SKIRT_LEG_ROOM_CM * t,
      depthRatio: 0.8,
      centerX: 0,
    }
    return toRing(section, color(y), foldDepthFor(hipsEase) + hem.flare * 6 * t)
  })
}

/** Купол шагового шва брюк в долях радиуса низа туловищной детали. */
const CROTCH_DOME = 0.5

/** Купол оката рукава: ткань закрывает круглое плечо так же, как купол руки манекена. */
const SLEEVE_HEAD_DOME = 0.35

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
  const make = (
    kind: GarmentPartKind,
    sections: Section[],
    easeFor: (y: number) => number,
    domeTop = 0,
  ): GarmentPart => ({
    kind,
    rings: sections.map((section) => dressRing(section, easeFor(section.y), color)),
    capBottom: false,
    capTop: domeTop > 0,
    foldCount: FOLDS.limb,
    edgeThickness: FABRIC_EDGE_CM,
    domeTop,
    domeBottom: 0,
  })
  if (spec.sleeveBottom) {
    const bottom = spec.sleeveBottom(l, h)
    const sleeveEase = spec.baseEaseCm * 0.6 + Math.max(easeAt(eases, l.chestY, 0), 0) * 0.2
    for (const arm of [body.parts.leftArm, body.parts.rightArm]) {
      // Рукав доходит до верха руки и закрывается окатом поверх плеча.
      const top = arm.sections[arm.sections.length - 1]?.y ?? l.shoulderY
      const sections = sliceSections(arm.sections, bottom, top)
      parts.push(make('sleeve', sections, () => sleeveEase, SLEEVE_HEAD_DOME))
    }
  }
  if (spec.legs) {
    const hipsEase = Math.max(easeAt(eases, l.hipsY, spec.baseEaseCm), 0)
    // Свободные бёдра переходят в широкий верх штанины и плавно сходят к щиколотке.
    const legEase = (y: number) => {
      const t = Math.min(Math.max((y - l.ankleY) / (l.crotchY - l.ankleY), 0), 1)
      return spec.baseEaseCm * 0.6 + hipsEase * 0.45 * t * t
    }
    for (const leg of [body.parts.leftLeg, body.parts.rightLeg]) {
      // Штанина доходит до верха бедра и закрыта плоско: верх спрятан под туловищной деталью.
      const legTop = leg.sections[leg.sections.length - 1]?.y ?? l.crotchY
      const part = make('leg', sliceSections(leg.sections, l.ankleY, legTop), legEase)
      parts.push({ ...part, capTop: true })
    }
  }
  return parts
}

/**
 * Сечения тела под туловищной деталью. Ниже линии бёдер ткань висит прямо, а не повторяет
 * сужение тела между ног, поэтому сечения не уже бёдер. У брюк деталь заканчивается чуть
 * выше шага куполом шагового шва и закрывает верх штанин.
 */
function garmentTorsoSections(body: BodyModel, bottom: number, top: number): Section[] {
  const sections = sliceSections(body.parts.torso.sections, bottom, top)
  const hips = sectionAt(body.parts.torso.sections, body.landmarks.hipsY)
  return sections.map((section) => {
    if (section.y >= hips.y) return section
    return section.girth < hips.girth
      ? { ...section, girth: hips.girth, depthRatio: hips.depthRatio, features: hips.features }
      : section
  })
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
  const colorAt = (y: number) => ringColor(y, eases, mode, product, band)
  // У низа вещи складки глубже: ткань там ничем не удержана.
  const hemBoost = (y: number) => (spec.legs ? 1 : 1 + 0.6 * Math.exp(-(y - bottom) / band))
  const torsoPart: GarmentPart = {
    kind: 'torso',
    rings: [
      ...hemRings(body, spec, eases, colorAt),
      ...garmentTorsoSections(body, bottom, top).map((section) =>
        dressRing(
          section,
          easeAt(eases, section.y, spec.baseEaseCm),
          colorAt(section.y),
          hemBoost(section.y),
        ),
      ),
    ],
    // У брюк низ туловищной детали закрыт куполом шагового шва: между ног нет просвета.
    capBottom: spec.legs,
    capTop: false,
    foldCount: spec.hem ? FOLDS.skirt : FOLDS.torso,
    edgeThickness: FABRIC_EDGE_CM,
    domeTop: 0,
    domeBottom: spec.legs ? CROTCH_DOME : 0,
  }
  // Рукава и штанины вне зон сетки, поэтому всегда в цвете товара.
  return [torsoPart, ...limbParts(body, spec, eases, product)]
}
