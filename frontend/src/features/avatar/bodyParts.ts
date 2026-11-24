// Части манекена: сечения туловища, ног и рук по меркам и антропометрическим пропорциям.
// Точными остаются обхваты груди, талии и бёдер — по ним подбирается размер. Остальное
// (высоты уровней, обхваты рук и ног, выпуклости) — усреднённые доли роста и обхватов.
import type { BodyZone } from '../../types/analysis'
import type { Measurements } from '../../types/body'
import { ramanujanPerimeter } from './ellipse'
import { NO_FEATURES, type Features } from './profile'
import type { Landmarks, Section } from './sections'

/** Отношения глубины к ширине для груди, талии и бёдер у женской и мужской фигуры. */
const DEPTH_RATIOS = {
  female: { chest: 0.75, waist: 0.72, hips: 0.78 },
  male: { chest: 0.68, waist: 0.75, hips: 0.72 },
} as const

/** Ширина плеч по умолчанию как доля роста, если мерка не указана. */
const DEFAULT_SHOULDER_SHARE = { female: 0.21, male: 0.23 } as const

/** Наклон рук от вертикали (тангенс): лёгкая A-поза, руки не прилипают к телу. */
const ARM_TILT = 0.16

/** Полуширина эллипса с данным обхватом и отношением осей. */
function halfWidth(girth: number, depthRatio: number): number {
  return girth / ramanujanPerimeter(1, depthRatio)
}

/** Половина ширины плеч: из мерки или по доле роста. */
export function shoulderHalfWidth(m: Measurements): number {
  return (m.shouldersCm ?? DEFAULT_SHOULDER_SHARE[m.gender] * m.heightCm) / 2
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

/** Выпуклости без лишних нулей в описании. */
function features(partial: Partial<Features>): Features {
  return { ...NO_FEATURES, ...partial }
}

/**
 * Выпуклости туловища по уровням снизу вверх. Грудь у женской фигуры тем заметнее,
 * чем больше разница груди и талии; живот появляется, когда талия близка к бёдрам.
 */
function torsoFeatures(m: Measurements): Features[] {
  const female = m.gender === 'female'
  const bust = female ? Math.min(Math.max((m.chestCm - m.waistCm) / 100, 0.06), 0.28) : 0.05
  const belly = Math.min(Math.max((m.waistCm / m.hipsCm - 0.78) * 0.5, 0), 0.12)
  const glutes = female ? 0.18 : 0.12
  return [
    features({ buttocks: glutes * 0.5 }),
    features({ buttocks: glutes * 0.85 }),
    features({ buttocks: glutes }),
    features({ buttocks: glutes * 0.35, belly }),
    features({ belly: belly * 0.6 }),
    features({ bust: bust * 0.35, shoulderBlades: 0.03 }),
    features({ bust, shoulderBlades: 0.06 }),
    features({ bust: bust * 0.4, shoulderBlades: 0.07 }),
    features({ shoulderBlades: 0.03 }),
    NO_FEATURES,
    NO_FEATURES,
  ]
}

/** Сечения туловища от промежности до шеи; грудь, талия и бёдра равны меркам. */
export function buildTorso(m: Measurements, l: Landmarks, shoulderHalf: number): Section[] {
  const r = DEPTH_RATIOS[m.gender]
  const underbust = m.waistCm + (m.chestCm - m.waistCm) * 0.6
  const neckGirth = m.chestCm * 0.37
  // Плечевое сечение задаётся шириной плеч: полуось X чуть меньше половины ширины плеч.
  const shoulderA = shoulderHalf * 0.92
  const shoulderB = halfWidth(m.chestCm, r.chest) * r.chest * 0.8
  const rows: Array<[number, number, number, number, BodyZone?]> = [
    // Низ туловища сужается между ногами, чтобы не было «ступеньки» на стыке с бёдрами.
    [l.crotchY - 0.015 * m.heightCm, m.hipsCm * 0.5, 0.8, 0],
    [l.crotchY, m.hipsCm * 0.75, 0.75, 0],
    [l.hipsY, m.hipsCm, r.hips, 0, 'hips'],
    [(l.hipsY + l.waistY) / 2, (m.hipsCm + m.waistCm) / 2, (r.hips + r.waist) / 2, 0],
    [l.waistY, m.waistCm, r.waist, 0, 'waist'],
    [(l.waistY + l.chestY) / 2, underbust, (r.waist + r.chest) / 2, 0],
    [l.chestY, m.chestCm, r.chest, 0, 'chest'],
    [l.armpitY, m.chestCm * 0.97, r.chest * 0.95, 0],
    [l.shoulderY, ramanujanPerimeter(shoulderA, shoulderB), shoulderB / shoulderA, -0.5],
    // Шея слегка наклонена вперёд, как у человека в естественной позе.
    [l.neckBaseY, neckGirth, 0.9, 0.5],
    [l.neckTopY, neckGirth * 0.95, 0.92, 1.5],
  ]
  const levelFeatures = torsoFeatures(m)
  return rows.map(([y, girth, depthRatio, centerZ, zone], index) => ({
    y,
    girth,
    depthRatio,
    centerX: 0,
    centerZ,
    features: levelFeatures[index],
    zone,
  }))
}

/** Сечения одной ноги от стопы до верха бедра; side = −1 для левой, +1 для правой. */
export function buildLeg(m: Measurements, l: Landmarks, side: number): Section[] {
  const hipsHalf = halfWidth(m.hipsCm, DEPTH_RATIOS[m.gender].hips)
  const top = hipsHalf * 0.48
  const bottom = hipsHalf * 0.42
  const c = l.crotchY
  // Стопа — вытянутый вперёд эллипс: длина ~15 % роста, пятка чуть позади щиколотки.
  const footA = 0.026 * m.heightCm
  const footB = 0.075 * m.heightCm
  const footGirth = ramanujanPerimeter(footA, footB)
  const footZ = footB - 0.03 * m.heightCm
  const rows: Array<[number, number, number, number, number]> = [
    [0, footGirth, footB / footA, bottom, footZ],
    [0.022 * m.heightCm, footGirth * 0.92, (footB / footA) * 0.85, bottom, footZ * 0.8],
    [l.ankleY, m.hipsCm * 0.22, 1, bottom, 0],
    [c * 0.25, m.hipsCm * 0.27, 1, bottom, 0],
    [c * 0.4, m.hipsCm * 0.37, 0.95, (top + bottom) / 2, -0.5],
    [l.kneeY, m.hipsCm * 0.36, 0.95, (top + bottom) / 2, 0.5],
    [c * 0.72, m.hipsCm * 0.46, 0.95, top, 0.5],
    [c * 0.87, m.hipsCm * 0.53, 0.95, top, 0],
    [c, m.hipsCm * 0.58, 0.95, top, 0],
    [c + 0.03 * m.heightCm, m.hipsCm * 0.6, 0.95, top, 0],
  ]
  return rows.map(([y, girth, depthRatio, x, z]) => ({
    y,
    girth,
    depthRatio,
    centerX: side * x,
    centerZ: z,
  }))
}

/** Сечения одной руки от кончиков пальцев до плеча; кисть плоская, руки в лёгкой A-позе. */
export function buildArm(
  m: Measurements,
  l: Landmarks,
  side: number,
  shoulderHalf: number,
): Section[] {
  const upperArm = m.chestCm * 0.3
  const x = shoulderHalf + (upperArm / (2 * Math.PI)) * 0.6
  const tilt = (y: number) => Math.max(l.shoulderY - y, 0) * ARM_TILT
  const rows: Array<[number, number, number, number, number]> = [
    [0.4 * m.heightCm, m.chestCm * 0.13, 1.8, x - 1, 2.5],
    [0.44 * m.heightCm, m.chestCm * 0.2, 2.3, x, 2],
    [l.wristY, m.chestCm * 0.16, 1.4, x, 1.5],
    [l.elbowY, m.chestCm * 0.25, 0.95, x, 0],
    [l.armpitY, upperArm, 0.9, x, 0],
    [l.shoulderY, upperArm * 0.95, 0.9, x - 1, 0],
    [l.shoulderY + 0.012 * m.heightCm, upperArm * 0.55, 0.9, x - 2, 0],
  ]
  return rows.map(([y, girth, depthRatio, cx, z]) => ({
    y,
    girth,
    depthRatio,
    centerX: side * (cx + tilt(y)),
    centerZ: z,
  }))
}
