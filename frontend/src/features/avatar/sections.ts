// Параметрический манекен: мерки → горизонтальные сечения-эллипсы на антропометрических высотах.
// Пропорции высот и обхватов рук и ног — усреднённые доли роста и обхватов; точными остаются
// обхваты груди, талии и бёдер из мерок, потому что именно по ним подбирается размер.
import type { BodyZone } from '../../types/analysis'
import type { Measurements } from '../../types/body'
import {
  buildArm,
  buildHead,
  buildLandmarks,
  buildLeg,
  buildTorso,
  shoulderHalfWidth,
} from './bodyParts'
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
  /**
   * Готовый контур сечения (радиусы от центра по равным углам), если сечение снято
   * со сканированного тела. Обхват girth тогда равен периметру этого контура.
   */
  radii?: number[]
}

export type PartName = 'head' | 'torso' | 'leftLeg' | 'rightLeg' | 'leftArm' | 'rightArm'

/** Часть тела: сечения снизу вверх, закрывать ли концы и насколько скруглять крышки. */
export interface BodyPart {
  sections: Section[]
  capBottom: boolean
  capTop: boolean
  /** Высота купола на конце в долях радиуса (0 — плоская крышка), см. LoftOptions. */
  domeBottom: number
  domeTop: number
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

/** Модель манекена: части тела (включая голову без черт лица) и уровни для построения одежды. */
export interface BodyModel {
  heightCm: number
  parts: Record<PartName, BodyPart>
  landmarks: Landmarks
  /** Вершины тела-скана (если тело из MakeHuman): по ним одежда проверяется на просвечивание. */
  surface?: BodySurface
}

/** Вершины подогнанного тела и номер части тела у каждой (см. PART в humanModel). */
export interface BodySurface {
  positions: Float32Array
  parts: Uint8Array
  /** Сколько вершин тела (дальше в positions могут идти центры суставов). */
  count: number
}

/** Купол макушки в долях радиуса верхнего сечения головы: макушка оказывается на ~99,7 % роста. */
export const HEAD_DOME = 0.7

/** Закрытая с обоих концов часть тела с заданным скруглением крышек. */
function closedPart(sections: Section[], domeBottom: number, domeTop: number): BodyPart {
  return { sections, capBottom: true, capTop: true, domeBottom, domeTop }
}

/** Строит модель манекена по меркам пользователя. */
export function buildBodyModel(m: Measurements): BodyModel {
  const landmarks = buildLandmarks(m)
  const shoulderHalf = shoulderHalfWidth(m)
  // Скругления: макушка, плечи и кончики пальцев круглые; стопа плоская, как подошва;
  // верх ноги и низ головы спрятаны внутри туловища и шеи.
  const arm = (side: number) => closedPart(buildArm(m, landmarks, side, shoulderHalf), 1, 0.8)
  const leg = (side: number) => closedPart(buildLeg(m, landmarks, side), 0, 0)
  return {
    heightCm: m.heightCm,
    parts: {
      head: closedPart(buildHead(m, landmarks), 0, HEAD_DOME),
      torso: closedPart(buildTorso(m, landmarks, shoulderHalf), 0.5, 0),
      leftLeg: leg(-1),
      rightLeg: leg(1),
      leftArm: arm(-1),
      rightArm: arm(1),
    },
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
    radii: mixRadii(lower.radii, upper.radii, t),
  }
}

/** Смешивает контуры двух сечений; если у одного контура нет, результат без контура. */
export function mixRadii(
  from: readonly number[] | undefined,
  to: readonly number[] | undefined,
  t: number,
): number[] | undefined {
  if (!from || !to || from.length !== to.length) return undefined
  return from.map((radius, index) => lerp(radius, to[index] as number, t))
}

/** Оставляет сечения в диапазоне высот [yMin, yMax], добавляя сечения точно на границах. */
export function sliceSections(sections: Section[], yMin: number, yMax: number): Section[] {
  const inside = sections.filter((section) => section.y > yMin && section.y < yMax)
  return [sectionAt(sections, yMin), ...inside, sectionAt(sections, yMax)]
}
