// Параметрический манекен: мерки → горизонтальные сечения-эллипсы на антропометрических высотах.
// Пропорции высот и обхватов рук и ног — усреднённые доли роста и обхватов; точными остаются
// обхваты груди, талии и бёдер из мерок, потому что именно по ним подбирается размер.
import type { BodyZone } from '../../types/analysis'
import type { Measurements } from '../../types/body'
import { ramanujanPerimeter } from './ellipse'

/** Горизонтальное сечение части тела. Все величины в сантиметрах, y — высота от пола. */
export interface Section {
  y: number
  girth: number
  /** Отношение глубины сечения к ширине (полуось Z / полуось X). */
  depthRatio: number
  /** Смещение центра сечения по оси X (для ног и рук). */
  centerX: number
  /** Зона размерной сетки, которой соответствует сечение. */
  zone?: BodyZone
}

export type PartName = 'torso' | 'leftLeg' | 'rightLeg' | 'leftArm' | 'rightArm'

/** Часть тела: сечения снизу вверх и признак, закрывать ли концы «крышкой». */
export interface BodyPart {
  sections: Section[]
  capBottom: boolean
  capTop: boolean
}

/** Высоты ключевых уровней тела в сантиметрах от пола. */
export interface Landmarks {
  ankleY: number
  kneeY: number
  crotchY: number
  hipsY: number
  waistY: number
  chestY: number
  armpitY: number
  shoulderY: number
  neckBaseY: number
  neckTopY: number
  elbowY: number
  wristY: number
}

/** Модель манекена: части тела, голова-сфера и уровни для построения одежды. */
export interface BodyModel {
  heightCm: number
  parts: Record<PartName, BodyPart>
  head: { y: number; radius: number }
  landmarks: Landmarks
}

/** Отношения глубины к ширине для груди, талии и бёдер у женской и мужской фигуры. */
const DEPTH_RATIOS = {
  female: { chest: 0.75, waist: 0.72, hips: 0.78 },
  male: { chest: 0.68, waist: 0.75, hips: 0.72 },
} as const

/** Ширина плеч по умолчанию как доля роста, если мерка не указана. */
const DEFAULT_SHOULDER_SHARE = { female: 0.21, male: 0.23 } as const

/** Полуширина эллипса с данным обхватом и отношением осей. */
function halfWidth(girth: number, depthRatio: number): number {
  return girth / ramanujanPerimeter(1, depthRatio)
}

/** Высоты уровней тела. Промежность берётся из длины ноги по шву, если она указана. */
export function buildLandmarks(m: Measurements): Landmarks {
  const h = m.heightCm
  // Длина по шву ограничена разумной долей роста, чтобы манекен не ломался на крайних мерках.
  const crotchY = Math.min(Math.max(m.inseamCm ?? 0.46 * h, 0.4 * h), 0.49 * h)
  return {
    ankleY: 0.045 * h,
    kneeY: crotchY * 0.57,
    crotchY,
    hipsY: crotchY + 0.05 * h,
    waistY: 0.62 * h,
    chestY: 0.72 * h,
    armpitY: 0.765 * h,
    shoulderY: 0.815 * h,
    neckBaseY: 0.835 * h,
    neckTopY: 0.87 * h,
    elbowY: 0.62 * h,
    wristY: 0.485 * h,
  }
}

/** Сечения туловища от промежности до шеи; грудь, талия и бёдра равны меркам. */
function buildTorso(m: Measurements, l: Landmarks, shoulderHalf: number): Section[] {
  const r = DEPTH_RATIOS[m.gender]
  const underbust = m.waistCm + (m.chestCm - m.waistCm) * 0.6
  const neckGirth = m.chestCm * 0.37
  // Плечевое сечение задаётся шириной плеч: полуось X чуть меньше половины ширины плеч.
  const shoulderA = shoulderHalf * 0.92
  const shoulderB = halfWidth(m.chestCm, r.chest) * r.chest * 0.8
  const rows: Array<[number, number, number, BodyZone?]> = [
    // Низ туловища сужается между ногами, чтобы не было «ступеньки» на стыке с бёдрами.
    [l.crotchY - 0.015 * m.heightCm, m.hipsCm * 0.5, 0.8],
    [l.crotchY, m.hipsCm * 0.75, 0.75],
    [l.hipsY, m.hipsCm, r.hips, 'hips'],
    [(l.hipsY + l.waistY) / 2, (m.hipsCm + m.waistCm) / 2, (r.hips + r.waist) / 2],
    [l.waistY, m.waistCm, r.waist, 'waist'],
    [(l.waistY + l.chestY) / 2, underbust, (r.waist + r.chest) / 2],
    [l.chestY, m.chestCm, r.chest, 'chest'],
    [l.armpitY, m.chestCm * 0.97, r.chest * 0.95],
    [l.shoulderY, ramanujanPerimeter(shoulderA, shoulderB), shoulderB / shoulderA],
    [l.neckBaseY, neckGirth, 0.9],
    [l.neckTopY, neckGirth, 0.9],
  ]
  return rows.map(([y, girth, depthRatio, zone]) => ({ y, girth, depthRatio, centerX: 0, zone }))
}

/** Сечения одной ноги от стопы до верха бедра; side = −1 для левой, +1 для правой. */
function buildLeg(m: Measurements, l: Landmarks, side: number): Section[] {
  const hipsHalf = halfWidth(m.hipsCm, DEPTH_RATIOS[m.gender].hips)
  const top = hipsHalf * 0.48
  const bottom = hipsHalf * 0.42
  const c = l.crotchY
  const rows: Array<[number, number, number, number]> = [
    [0, m.hipsCm * 0.24, 1.3, bottom],
    [l.ankleY, m.hipsCm * 0.22, 1, bottom],
    [c * 0.25, m.hipsCm * 0.27, 1, bottom],
    [c * 0.4, m.hipsCm * 0.37, 0.95, (top + bottom) / 2],
    [l.kneeY, m.hipsCm * 0.36, 0.95, (top + bottom) / 2],
    [c * 0.72, m.hipsCm * 0.46, 0.95, top],
    [c * 0.87, m.hipsCm * 0.53, 0.95, top],
    [c, m.hipsCm * 0.58, 0.95, top],
    [c + 0.03 * m.heightCm, m.hipsCm * 0.6, 0.95, top],
  ]
  return rows.map(([y, girth, depthRatio, x]) => ({ y, girth, depthRatio, centerX: side * x }))
}

/** Сечения одной руки от кончиков пальцев до плеча, руки слегка отведены в стороны. */
function buildArm(m: Measurements, l: Landmarks, side: number, shoulderHalf: number): Section[] {
  const upperArm = m.chestCm * 0.3
  const x = shoulderHalf + (upperArm / (2 * Math.PI)) * 0.6
  const rows: Array<[number, number, number, number]> = [
    [0.4 * m.heightCm, m.chestCm * 0.12, 0.5, x + 4],
    [0.44 * m.heightCm, m.chestCm * 0.22, 0.45, x + 3.5],
    [l.wristY, m.chestCm * 0.17, 0.7, x + 3],
    [l.elbowY, m.chestCm * 0.25, 0.9, x + 1.5],
    [l.armpitY, upperArm, 0.9, x],
    [l.shoulderY, upperArm * 0.95, 0.9, x - 1],
    [l.shoulderY + 0.012 * m.heightCm, upperArm * 0.55, 0.9, x - 2],
  ]
  return rows.map(([y, girth, depthRatio, cx]) => ({ y, girth, depthRatio, centerX: side * cx }))
}

/** Строит модель манекена по меркам пользователя. */
export function buildBodyModel(m: Measurements): BodyModel {
  const landmarks = buildLandmarks(m)
  const shoulderHalf = (m.shouldersCm ?? DEFAULT_SHOULDER_SHARE[m.gender] * m.heightCm) / 2
  const limb = (sections: Section[]): BodyPart => ({ sections, capBottom: true, capTop: true })
  return {
    heightCm: m.heightCm,
    parts: {
      torso: { sections: buildTorso(m, landmarks, shoulderHalf), capBottom: true, capTop: true },
      leftLeg: limb(buildLeg(m, landmarks, -1)),
      rightLeg: limb(buildLeg(m, landmarks, 1)),
      leftArm: limb(buildArm(m, landmarks, -1, shoulderHalf)),
      rightArm: limb(buildArm(m, landmarks, 1, shoulderHalf)),
    },
    head: { y: 0.935 * m.heightCm, radius: 0.06 * m.heightCm },
    landmarks,
  }
}

/** Линейная интерполяция числа. */
function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/** Сечение на высоте y между двумя соседними сечениями (линейно). */
export function sectionAt(sections: Section[], y: number): Section {
  const first = sections[0]
  const last = sections[sections.length - 1]
  if (!first || !last) throw new RangeError('Нет сечений')
  if (y <= first.y) return { ...first, y, zone: undefined }
  if (y >= last.y) return { ...last, y, zone: undefined }
  const upperIndex = sections.findIndex((section) => section.y >= y)
  const upper = sections[upperIndex] as Section
  const lower = sections[upperIndex - 1] as Section
  const t = (y - lower.y) / (upper.y - lower.y)
  return {
    y,
    girth: lerp(lower.girth, upper.girth, t),
    depthRatio: lerp(lower.depthRatio, upper.depthRatio, t),
    centerX: lerp(lower.centerX, upper.centerX, t),
  }
}

/** Оставляет сечения в диапазоне высот [yMin, yMax], добавляя сечения точно на границах. */
export function sliceSections(sections: Section[], yMin: number, yMax: number): Section[] {
  const inside = sections.filter((section) => section.y > yMin && section.y < yMax)
  return [sectionAt(sections, yMin), ...inside, sectionAt(sections, yMax)]
}
