// Несколько вещей на манекене сразу: каждая следующая вещь надевается поверх предыдущих.
// Верхний слой расширяется там, где нижний слой иначе проступил бы сквозь ткань.
import type { SizeOption } from '../../types/analysis'
import type { Category } from '../../types/catalog'
import type { LoftRing } from '../avatar/loft'
import type { BodyModel } from '../avatar/sections'
import { buildGarment, type ColorMode, type GarmentPart } from './garment'

/** Вещь для сцены: категория, цвет и выбранный размер. */
export interface SceneGarment {
  category: Category
  colorHex: string
  option: SizeOption
}

/** Зазор между слоями ткани, см: учитывает складки и подгибы краёв. */
export const LAYER_GAP_CM = 1.5

/** Полуоси кольца нижнего слоя на высоте y (линейно между кольцами); вне детали — null. */
function innerRingAt(rings: LoftRing[], y: number): LoftRing | null {
  const sorted = [...rings].sort((first, second) => first.y - second.y)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (!first || !last || y < first.y || y > last.y) return null
  const upperIndex = sorted.findIndex((ring) => ring.y >= y)
  const upper = sorted[upperIndex] as LoftRing
  const lower = sorted[Math.max(upperIndex - 1, 0)] as LoftRing
  const span = upper.y - lower.y
  const t = span > 0 ? (y - lower.y) / span : 0
  const mix = (from: number, to: number) => from + (to - from) * t
  return {
    ...lower,
    y,
    a: mix(lower.a, upper.a),
    b: mix(lower.b, upper.b),
    centerX: mix(lower.centerX, upper.centerX),
    centerZ: mix(lower.centerZ, upper.centerZ),
    foldDepth: Math.max(lower.foldDepth, upper.foldDepth),
  }
}

/**
 * Какие детали нижнего слоя закрывает деталь верхнего: туловище — туловище и штанины
 * (у длинной куртки), рукав — рукав той же стороны.
 */
function covers(outer: GarmentPart, inner: GarmentPart): boolean {
  if (outer.kind === 'torso') return inner.kind === 'torso' || inner.kind === 'leg'
  if (outer.kind !== 'sleeve' || inner.kind !== 'sleeve') return false
  const side = (part: GarmentPart) => Math.sign(part.rings[0]?.centerX ?? 0)
  return side(outer) === side(inner)
}

/** Расширяет кольцо верхнего слоя так, чтобы кольцо нижнего целиком было внутри с зазором. */
function encloseRing(ring: LoftRing, inner: LoftRing, gapCm: number): LoftRing {
  const reach = (offset: number, axis: number) =>
    Math.abs(offset) + axis + inner.foldDepth + ring.foldDepth + gapCm
  const needA = reach(inner.centerX - ring.centerX, inner.a)
  const needB = reach(inner.centerZ - ring.centerZ, inner.b)
  return { ...ring, a: Math.max(ring.a, needA), b: Math.max(ring.b, needB) }
}

/** Надевает деталь поверх всех деталей нижнего слоя, которые она закрывает. */
function layerPart(outer: GarmentPart, under: GarmentPart[], gapCm: number): GarmentPart {
  const covered = under.filter((inner) => covers(outer, inner))
  if (covered.length === 0) return outer
  const rings = outer.rings.map((ring) =>
    covered.reduce((current, inner) => {
      const innerRing = innerRingAt(inner.rings, ring.y)
      return innerRing ? encloseRing(current, innerRing, gapCm) : current
    }, ring),
  )
  return { ...outer, rings }
}

/** Надевает вещь поверх уже надетых деталей. */
export function layerOver(
  outer: GarmentPart[],
  under: GarmentPart[],
  gapCm = LAYER_GAP_CM,
): GarmentPart[] {
  return outer.map((part) => layerPart(part, under, gapCm))
}

/**
 * Строит весь образ на манекене. Вещи передаются снизу вверх по слоям
 * (низ или платье, затем верх, затем верхняя одежда). Возвращает детали каждой вещи.
 */
export function buildOutfit(
  body: BodyModel,
  garments: SceneGarment[],
  mode: ColorMode,
): GarmentPart[][] {
  const worn: GarmentPart[] = []
  return garments.map((garment) => {
    const parts = layerOver(
      buildGarment(body, garment.category, garment.option, garment.colorHex, mode),
      worn,
    )
    worn.push(...parts)
    return parts
  })
}
