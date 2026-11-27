// Ткань, натянутая поверх: контур кольца расширяется до выпуклой оболочки того, что под ним.
import type { LoftRing } from '../avatar/loft'
import { convexHull, radialProfile, smoothAround, type Point2 } from '../avatar/meshSlice'
import { outlineRadii } from '../avatar/profile'

/** Число направлений, по которым сравниваются контуры. */
export const ENCLOSE_SEGMENTS = 48

/** Сколько раз сглаживать контур по окружности. */
const AROUND_PASSES = 2

/** Точки контура кольца в плоскости XZ, отодвинутые наружу на extra (см). */
export function ringPoints(ring: LoftRing, extra: number): Point2[] {
  return outlineRadii(ring, ENCLOSE_SEGMENTS).map((radius, k) => {
    const angle = (2 * Math.PI * k) / ENCLOSE_SEGMENTS
    const reach = radius + extra
    return [ring.centerX + reach * Math.cos(angle), ring.centerZ + reach * Math.sin(angle)]
  })
}

/** Кольцо с новым контуром; полуоси эллипса не меньше прежних и нового контура. */
export function withRadii(ring: LoftRing, outline: number[]): LoftRing {
  // Контур выпуклой оболочки сглаживается по окружности, иначе на ткани пятна бликов.
  const radii = smoothAround(outline, AROUND_PASSES, 1)
  const quarter = ENCLOSE_SEGMENTS / 4
  const at = (k: number) => radii[k % ENCLOSE_SEGMENTS] as number
  return {
    ...ring,
    radii,
    a: Math.max(ring.a, at(0), at(2 * quarter)),
    b: Math.max(ring.b, at(quarter), at(3 * quarter)),
  }
}

/**
 * Расширяет кольцо так, чтобы все внутренние кольца были внутри с зазором gapCm (вместе
 * со своими складками). Берётся выпуклая оболочка контуров, как у натянутой ткани: над
 * двумя штанинами или ногами ткань идёт ровно, без бугров между ними. Складки самого
 * кольца идут наружу от его контура, поэтому контур берётся без них.
 */
export function encloseRing(ring: LoftRing, inner: LoftRing[], gapCm: number): LoftRing {
  if (inner.length === 0) return ring
  const points = [
    ...ringPoints(ring, 0),
    ...inner.flatMap((each) => ringPoints(each, each.foldDepth + gapCm)),
  ]
  const center: Point2 = [ring.centerX, ring.centerZ]
  return withRadii(ring, radialProfile(convexHull(points), center, ENCLOSE_SEGMENTS))
}

/** Кольцо с выпуклым контуром: ткань, натянутая поверх, не заходит во впадины. */
export function convexRing(ring: LoftRing): LoftRing {
  const center: Point2 = [ring.centerX, ring.centerZ]
  const hull = convexHull(ringPoints(ring, 0))
  return withRadii(ring, radialProfile(hull, center, ENCLOSE_SEGMENTS))
}

/**
 * Плавно расширяет верх детали до контура cover (точки детали, под которую она уходит):
 * у кольца на высоте bottomY и выше — полностью, на blendCm ниже — не меняет. Так верх
 * штанины подходит к краю туловищной части брюк без ступеньки.
 */
export function blendUnder(
  rings: LoftRing[],
  cover: Point2[],
  bottomY: number,
  blendCm: number,
): LoftRing[] {
  return rings.map((ring) => {
    const share = Math.min(Math.max((ring.y - (bottomY - blendCm)) / blendCm, 0), 1)
    if (share === 0 || cover.length === 0) return ring
    const weight = share * share * (3 - 2 * share)
    const center: Point2 = [ring.centerX, ring.centerZ]
    const base = outlineRadii(ring, ENCLOSE_SEGMENTS)
    const target = radialProfile(
      convexHull([...ringPoints(ring, 0), ...cover]),
      center,
      ENCLOSE_SEGMENTS,
    )
    const radii = base.map((radius, k) => radius + ((target[k] as number) - radius) * weight)
    return convexRing(withRadii(ring, radii))
  })
}
