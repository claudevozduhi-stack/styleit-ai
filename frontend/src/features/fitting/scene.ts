// Сборка сеток сцены примерочной из модели тела и деталей вещи (без three.js, для тестов).
import { DEFAULT_LOFT, loftMesh, toRing, type MeshData } from '../avatar/loft'
import type { BodyModel } from '../avatar/sections'
import { MANNEQUIN_HEX, hexToRgb } from './colors'
import type { GarmentPart } from './garment'

/** Сетки манекена: туловище, ноги и руки с закрытыми концами. Голова рисуется сферой. */
export function bodyMeshes(body: BodyModel): MeshData[] {
  const color = hexToRgb(MANNEQUIN_HEX)
  return Object.values(body.parts).map((part) =>
    loftMesh(
      part.sections.map((section) => toRing(section, color)),
      { ...DEFAULT_LOFT, capBottom: part.capBottom, capTop: part.capTop },
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
    }),
  )
}
