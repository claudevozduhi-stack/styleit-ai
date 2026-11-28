// Текстуры ткани для three.js: карты-сканы (нормали и шероховатость) и процедурный рельеф.
// Карты грузятся лениво, только для тканей, которые есть на манекене; пока их нет,
// материал использует процедурный рельеф, поэтому примерка не ждёт загрузки.
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  TextureLoader,
  type Texture,
} from 'three'
import { TEXTURE_UNIT_CM } from '../avatar/loftGrid'
import {
  FABRIC_LOOK,
  FABRIC_TEXTURE_SIZE,
  fabricBumpMap,
  fabricMapUrls,
  textureRepeat,
  type FabricKind,
} from './fabric'

/** Карты ткани, загруженные с сервера фронтенда. */
export interface FabricMaps {
  normal: Texture
  rough: Texture
}

/** Чёткость текстуры под углом к камере (анизотропная фильтрация), если видеокарта умеет. */
const ANISOTROPY = 4

/** Общие настройки карты ткани: повтор по развёртке, мипмапы, данные без цветового профиля. */
function prepare(texture: Texture, kind: FabricKind): Texture {
  const repeat = textureRepeat(FABRIC_LOOK[kind], TEXTURE_UNIT_CM)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat, repeat)
  // Нормали и шероховатость — числа, а не цвет: гамма-коррекция их бы исказила.
  texture.colorSpace = NoColorSpace
  // Мипмапы убирают муар фактуры на удалении камеры.
  texture.generateMipmaps = true
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.anisotropy = ANISOTROPY
  texture.needsUpdate = true
  return texture
}

/** Загружает карты нормалей и шероховатости ткани. */
export async function loadFabricMaps(kind: FabricKind): Promise<FabricMaps> {
  const urls = fabricMapUrls(kind, import.meta.env.BASE_URL)
  const loader = new TextureLoader()
  const [normal, rough] = await Promise.all([
    loader.loadAsync(urls.normal),
    loader.loadAsync(urls.rough),
  ])
  return { normal: prepare(normal, kind), rough: prepare(rough, kind) }
}

/**
 * Карты ткани через TanStack Query: каждая ткань грузится один раз за сеанс.
 * Пока загрузка идёт или если она не удалась, возвращает null.
 */
export function useFabricMaps(kind: FabricKind): FabricMaps | null {
  const query = useQuery({
    queryKey: ['fabric-maps', kind],
    queryFn: () => loadFabricMaps(kind),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
  return query.data ?? null
}

/** Процедурный рельеф ткани: запасной вариант, пока карты-сканы не загружены. */
export function useFabricBump(kind: FabricKind): Texture {
  const texture = useMemo(() => {
    const size = FABRIC_TEXTURE_SIZE
    const result = new DataTexture(fabricBumpMap(kind, size), size, size, RGBAFormat)
    return prepare(result, kind)
  }, [kind])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}
