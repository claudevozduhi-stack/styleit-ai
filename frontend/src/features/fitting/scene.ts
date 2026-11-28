// Сборка сеток сцены примерочной из модели тела и деталей вещи (без three.js, для тестов).
import { DEFAULT_LOFT, loftMesh, toRing, type MeshData } from '../avatar/loft'
import type { BodyModel } from '../avatar/sections'
import { MANNEQUIN_HEX, hexToRgb } from './colors'
import type { Category } from '../../types/catalog'
import { fabricFor } from './fabric'
import type { GarmentPart } from './garment'
import { garmentTrims } from './seams'

/** Сетки манекена: голова, туловище, ноги и руки с закрытыми и скруглёнными концами. */
export function bodyMeshes(body: BodyModel): MeshData[] {
  const color = hexToRgb(MANNEQUIN_HEX)
  return Object.values(body.parts).map((part) =>
    loftMesh(
      part.sections.map((section) => toRing(section, color)),
      {
        ...DEFAULT_LOFT,
        capBottom: part.capBottom,
        capTop: part.capTop,
        domeBottom: part.domeBottom,
        domeTop: part.domeTop,
      },
    ),
  )
}

/** Сетки вещи: каждая деталь — открытая «труба» из колец. */
export function garmentMeshes(parts: GarmentPart[]): MeshData[] {
  return parts.map((part) =>
    loftMesh(part.rings, {
      ...DEFAULT_LOFT,
      capBottom: part.capBottom,
      capTop: part.capTop,
      foldCount: part.foldCount,
      edgeThickness: part.edgeThickness,
      domeBottom: part.domeBottom,
      domeTop: part.domeTop,
    }),
  )
}

/** Вещи с поясом сверху, а не горловиной. */
const BOTTOM_WEAR: ReadonlySet<Category> = new Set(['trousers', 'jeans', 'skirt'])

/** Сетки вещи для сцены: детали ткани и отдельная сетка швов и строчки. */
export interface GarmentSceneData {
  meshes: MeshData[]
  trims: MeshData
}

/** Сетки деталей вещи и её швов по категории и названию товара (ткань — по названию). */
export function garmentSceneData(
  parts: GarmentPart[],
  category: Category,
  title = '',
): GarmentSceneData {
  const meshes = garmentMeshes(parts)
  const fabric = fabricFor(category, title)
  return { meshes, trims: garmentTrims(parts, meshes, fabric, BOTTOM_WEAR.has(category)) }
}
