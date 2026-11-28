// 3D-сцена примерочной: анатомическое тело по меркам (MakeHuman, CC0) и вещи слоями.
// Пока файл модели грузится или если он недоступен, показывается процедурный манекен.
// Загружается лениво (React.lazy), чтобы three.js не утяжелял остальные страницы.
import { Canvas, useThree } from '@react-three/fiber'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  PMREMGenerator,
  Vector2,
  type Texture,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Measurements } from '../../types/body'
import type { MeshData } from '../avatar/loft'
import { fitHuman } from '../avatar/humanFit'
import { loadHumanModel } from '../avatar/humanLoader'
import { humanMeshData } from '../avatar/humanMesh'
import type { HumanModel } from '../avatar/humanModel'
import { humanBodyModel } from '../avatar/humanSections'
import { buildBodyModel, type BodyModel } from '../avatar/sections'
import { MANNEQUIN_HEX, hexToRgb, srgbToLinear } from './colors'
import { FABRIC_LOOK, fabricFor, roughnessFactor, type FabricKind } from './fabric'
import { useFabricBump, useFabricMaps, type FabricMaps } from './fabricMaps'
import type { ColorMode } from './garment'
import { buildOutfit, type SceneGarment } from './layers'
import { bodyMeshes, garmentSceneData, type GarmentSceneData } from './scene'

/** Сантиметры модели → метры сцены. */
const CM_TO_M = 0.01
const BACKGROUND_HEX = '#f3f1ee'

export interface FittingSceneProps {
  measurements: Measurements
  /** Вещи снизу вверх по слоям: низ или платье, верх, верхняя одежда. */
  garments: SceneGarment[]
  colorMode: ColorMode
}

/** Геометрия из готовых массивов; освобождается при смене данных. */
function useGeometry(data: MeshData): BufferGeometry {
  const geometry = useMemo(() => {
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(data.positions, 3))
    result.setAttribute('normal', new BufferAttribute(data.normals, 3))
    // Цвета вершин заданы в sRGB, а свет считается в линейном пространстве.
    result.setAttribute('color', new BufferAttribute(data.colors.map(srgbToLinear), 3))
    result.setAttribute('uv', new BufferAttribute(data.uvs, 2))
    result.setIndex(new BufferAttribute(data.indices, 1))
    return result
  }, [data])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

/** Матовый манекен, как в витрине магазина. */
function BodyMesh({ data }: { data: MeshData }) {
  const geometry = useGeometry(data)
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.6} metalness={0} />
    </mesh>
  )
}

/** Свойства ткани, общие для деталей одной вещи: карты-сканы или процедурный рельеф. */
interface FabricSurface {
  kind: FabricKind
  maps: FabricMaps | null
  bump: Texture
}

/**
 * Ткань: отблеск ворса (sheen), у кожи — лаковый слой. Рельеф и матовость берутся из
 * карт-сканов; пока их нет — процедурный рельеф и ровная шероховатость.
 */
function GarmentMesh({ data, surface }: { data: MeshData; surface: FabricSurface }) {
  const geometry = useGeometry(data)
  const look = FABRIC_LOOK[surface.kind]
  const { maps } = surface
  const normalScale = useMemo(
    () => new Vector2(look.normalStrength, look.normalStrength),
    [look.normalStrength],
  )
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial
        // Новый материал при смене набора карт: шейдеру нужно пересобраться.
        key={maps ? 'scanned' : 'procedural'}
        vertexColors
        side={DoubleSide}
        roughness={maps ? roughnessFactor(look) : look.roughness}
        roughnessMap={maps?.rough ?? null}
        normalMap={maps?.normal ?? null}
        normalScale={normalScale}
        bumpMap={maps ? null : surface.bump}
        bumpScale={look.bumpScale}
        sheen={look.sheen}
        sheenRoughness={look.sheenRoughness}
        sheenColor="#ffffff"
        clearcoat={look.clearcoat}
        clearcoatRoughness={look.clearcoatRoughness}
      />
    </mesh>
  )
}

/** Швы и строчка: матовые нитки, чуть «впереди» ткани по глубине, чтобы не мерцать. */
function TrimMesh({ data }: { data: MeshData }) {
  const geometry = useGeometry(data)
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        side={DoubleSide}
        roughness={0.85}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  )
}

/** Все детали одной вещи с тканью по её названию или категории, плюс швы и строчка. */
function GarmentGroup({ data, garment }: { data: GarmentSceneData; garment: SceneGarment }) {
  const kind = fabricFor(garment.category, garment.title)
  const maps = useFabricMaps(kind)
  const bump = useFabricBump(kind)
  const surface = useMemo(() => ({ kind, maps, bump }), [kind, maps, bump])
  return (
    <>
      {data.meshes.map((mesh, index) => (
        <GarmentMesh key={index} data={mesh} surface={surface} />
      ))}
      {data.trims.indices.length > 0 && <TrimMesh data={data.trims} />}
    </>
  )
}

/** Вращение камеры вокруг манекена; сдвиг отключён, приближение ограничено. */
function CameraControls({ targetY }: { targetY: number }) {
  const camera = useThree((state) => state.camera)
  const canvas = useThree((state) => state.gl.domElement)
  useEffect(() => {
    const controls = new OrbitControls(camera, canvas)
    controls.target.set(0, targetY, 0)
    controls.enablePan = false
    controls.minDistance = 0.6
    controls.maxDistance = 4
    controls.maxPolarAngle = Math.PI * 0.55
    controls.update()
    return () => controls.dispose()
  }, [camera, canvas, targetY])
  return null
}

/** Сила отражённого света «студии»: мягкие блики и тени в складках, как на фото. */
const ENVIRONMENT_INTENSITY = 0.35
/**
 * Размытие окружения: панели света «комнаты» не отражаются в ткани прямоугольными
 * бликами в клетку, остаётся только мягкий рассеянный свет.
 */
const ENVIRONMENT_BLUR = 0.4

/**
 * Окружение-«комната» из three.js (генерируется кодом, без внешних файлов): даёт
 * рассеянный отражённый свет со всех сторон, поэтому ткань и манекен выглядят объёмно.
 */
function StudioEnvironment() {
  const renderer = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  useEffect(() => {
    const generator = new PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const target = generator.fromScene(room, ENVIRONMENT_BLUR)
    scene.environment = target.texture
    scene.environmentIntensity = ENVIRONMENT_INTENSITY
    room.dispose()
    generator.dispose()
    return () => {
      scene.environment = null
      target.dispose()
    }
  }, [renderer, scene])
  return null
}

/**
 * Мягкий студийный свет: сильнее рассеянный свет комнаты, основной свет слабее и с
 * размытой тенью, поэтому на ткани нет резких теней от рук, а складки видны.
 */
function StudioLights({ height }: { height: number }) {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#d8cfc4', 0.45]} />
      <directionalLight
        position={[1.5, height + 1.5, 2]}
        intensity={1.25}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-1.2}
        shadow-camera-right={1.2}
        shadow-camera-top={2.2}
        shadow-camera-bottom={-0.2}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={10}
      />
      <directionalLight position={[-2, height, 1]} intensity={0.6} />
      <directionalLight position={[0, height + 0.5, -2.5]} intensity={0.7} />
    </>
  )
}

/** Модель тела и его сетки: подогнанный скан, если модель загружена, иначе процедурный манекен. */
function sceneBody(
  measurements: Measurements,
  model: HumanModel | undefined,
): { body: BodyModel; bodyData: MeshData[] } {
  if (!model) {
    const body = buildBodyModel(measurements)
    return { body, bodyData: bodyMeshes(body) }
  }
  const fitted = fitHuman(model, measurements)
  return {
    body: humanBodyModel(model, fitted),
    bodyData: [humanMeshData(model, fitted.positions, hexToRgb(MANNEQUIN_HEX))],
  }
}

/** Сцена: свет, пол с мягкой тенью, манекен, вещи и вращение камеры пальцем или мышью. */
export default function FittingScene(props: FittingSceneProps) {
  const { measurements, garments, colorMode } = props
  const human = useQuery({
    queryKey: ['human-model'],
    queryFn: () => loadHumanModel(),
    staleTime: Infinity,
  })
  const { body, bodyData } = useMemo(
    () => sceneBody(measurements, human.data),
    [measurements, human.data],
  )
  const garmentData = useMemo(
    () =>
      buildOutfit(body, garments, colorMode).map((parts, index) => {
        const garment = garments[index] as SceneGarment
        return garmentSceneData(parts, garment.category, garment.title, body)
      }),
    [body, garments, colorMode],
  )
  const heightM = body.heightCm * CM_TO_M
  const centerY = heightM * 0.55
  return (
    <Canvas shadows="soft" camera={{ position: [0, centerY, 2.6], fov: 40 }} dpr={[1, 2]}>
      <color attach="background" args={[BACKGROUND_HEX]} />
      <StudioEnvironment />
      <StudioLights height={heightM} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.5, 64]} />
        <shadowMaterial opacity={0.18} />
      </mesh>
      <group scale={CM_TO_M}>
        {bodyData.map((data, index) => (
          <BodyMesh key={`body-${index}`} data={data} />
        ))}
        {garmentData.map((data, index) => (
          <GarmentGroup
            key={`garment-${index}`}
            data={data}
            garment={garments[index] as SceneGarment}
          />
        ))}
      </group>
      <CameraControls targetY={centerY} />
    </Canvas>
  )
}
