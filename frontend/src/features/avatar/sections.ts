// Параметрический манекен: мерки → горизонтальные сечения-эллипсы на антропометрических высотах.
// Пропорции высот и обхватов рук и ног — усреднённые доли роста и обхватов; точными остаются
// обхваты груди, талии и бёдер из мерок, потому что именно по ним подбирается размер.
import type { BodyZone } from '../../types/analysis'
import type { Measurements } from '../../types/body'
import { buildArm, buildLandmarks, buildLeg, buildTorso, shoulderHalfWidth } from './bodyParts'
import { NO_FEATURES, type Features } from './profile'

/** Горизонтальное сечение части тела. Все величины в сантиметрах, y — высота от пола. */
export interface Section {
  y: number
  girth: number
  /** Отношение глубины сечения к ширине (полуось Z / полуось X). */
  depthRatio: number
  /** Смещение центра сечения по оси X (для ног и рук). */
  centerX: number
  /** Смещение центра по оси Z (вперёд), например у стоп и шеи. По умолчанию 0. */
  centerZ?: number
  /** Анатомические выпуклости сечения; по умолчанию их нет. */
  features?: Features
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
  /** Голова — эллипсоид без черт лица: центр и радиус. */
  head: { y: number; z: number; radius: number }
  landmarks: Landmarks
}

/** Строит модель манекена по меркам пользователя. */
export function buildBodyModel(m: Measurements): BodyModel {
  const landmarks = buildLandmarks(m)
  const shoulderHalf = shoulderHalfWidth(m)
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
    head: { y: 0.932 * m.heightCm, z: 1.5, radius: 0.06 * m.heightCm },
    landmarks,
  }
}

/** Смешивает выпуклости двух сечений (отсутствие = нули). */
function mixSectionFeatures(
  from: Features | undefined,
  to: Features | undefined,
  t: number,
): Features {
  const a = from ?? NO_FEATURES
  const b = to ?? NO_FEATURES
  return {
    bust: lerp(a.bust, b.bust, t),
    buttocks: lerp(a.buttocks, b.buttocks, t),
    shoulderBlades: lerp(a.shoulderBlades, b.shoulderBlades, t),
    belly: lerp(a.belly, b.belly, t),
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
    centerZ: lerp(lower.centerZ ?? 0, upper.centerZ ?? 0, t),
    features: mixSectionFeatures(lower.features, upper.features, t),
  }
}

/** Оставляет сечения в диапазоне высот [yMin, yMax], добавляя сечения точно на границах. */
export function sliceSections(sections: Section[], yMin: number, yMax: number): Section[] {
  const inside = sections.filter((section) => section.y > yMin && section.y < yMax)
  return [sectionAt(sections, yMin), ...inside, sectionAt(sections, yMax)]
}
