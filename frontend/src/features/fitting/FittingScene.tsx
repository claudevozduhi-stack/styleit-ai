// 3D-сцена примерочной: процедурный манекен по меркам и вещь выбранного размера.
// Загружается лениво (React.lazy), чтобы three.js не утяжелял остальные страницы.
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  PMREMGenerator,
  RepeatWrapping,
  RGBAFormat,
  type Texture,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { SizeOption } from '../../types/analysis'
import type { Measurements } from '../../types/body'
import type { Category } from '../../types/catalog'
import type { MeshData } from '../avatar/loft'
import { buildBodyModel } from '../avatar/sections'
import { CATEGORY_FABRIC, FABRIC_TEXTURE_SIZE, fabricBumpMap, type FabricKind } from './fabric'
import { buildGarment, type ColorMode } from './garment'
import { bodyMeshes, garmentMeshes } from './scene'

/** Сантиметры модели → метры сцены. */
const CM_TO_M = 0.01
/** Сколько раз фактура повторяется по окружности детали. */
const FABRIC_REPEAT_AROUND = 10
const BACKGROUND_HEX = '#f3f1ee'

export interface FittingSceneProps {
  measurements: Measurements
  category: Category
  colorHex: string
  option: SizeOption
  colorMode: ColorMode
}

/** Геометрия из готовых массивов; освобождается при смене данных. */
function useGeometry(data: MeshData): BufferGeometry {
  const geometry = useMemo(() => {
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(data.positions, 3))
    result.setAttribute('normal', new BufferAttribute(data.normals, 3))
    result.setAttribute('color', new BufferAttribute(data.colors, 3))
    result.setAttribute('uv', new BufferAttribute(data.uvs, 2))
    result.setIndex(new BufferAttribute(data.indices, 1))
    return result
  }, [data])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

/** Фактура ткани для выбранной категории. */
function useFabricTexture(kind: FabricKind): Texture {
  const texture = useMemo(() => {
    const size = FABRIC_TEXTURE_SIZE
    const result = new DataTexture(fabricBumpMap(kind, size), size, size, RGBAFormat)
    result.wrapS = RepeatWrapping
    result.wrapT = RepeatWrapping
    result.repeat.set(FABRIC_REPEAT_AROUND, 1)
    // Мипмапы убирают муар фактуры на удалении камеры.
    result.generateMipmaps = true
    result.minFilter = LinearMipmapLinearFilter
    result.magFilter = LinearFilter
    result.needsUpdate = true
    return result
  }, [kind])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
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

/** Ткань: мягкий «бархатный» отблеск (sheen) и рельеф переплетения. */
function GarmentMesh({ data, fabric }: { data: MeshData; fabric: Texture }) {
  const geometry = useGeometry(data)
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial
        vertexColors
        side={DoubleSide}
        roughness={0.85}
        sheen={0.7}
        sheenRoughness={0.6}
        sheenColor="#ffffff"
        bumpMap={fabric}
        bumpScale={0.08}
      />
    </mesh>
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
    controls.minDistance = 1.2
    controls.maxDistance = 4
    controls.maxPolarAngle = Math.PI * 0.55
    controls.update()
    return () => controls.dispose()
  }, [camera, canvas, targetY])
  return null
}

/** Сила отражённого света «студии»: мягкие блики и тени в складках, как на фото. */
const ENVIRONMENT_INTENSITY = 0.25

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
    const target = generator.fromScene(room, 0.04)
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

/** Студийный свет: мягкий общий, основной с тенью, заполняющий и контровой. */
function StudioLights({ height }: { height: number }) {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#d8cfc4', 0.35]} />
      <directionalLight
        position={[1.5, height + 1.5, 2]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-1.2}
        shadow-camera-right={1.2}
        shadow-camera-top={2.2}
        shadow-camera-bottom={-0.2}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={6}
      />
      <directionalLight position={[-2, height, 1]} intensity={0.5} />
      <directionalLight position={[0, height + 0.5, -2.5]} intensity={0.7} />
    </>
  )
}

/** Сцена: свет, пол с мягкой тенью, манекен, вещь и вращение камеры пальцем или мышью. */
export default function FittingScene(props: FittingSceneProps) {
  const { measurements, category, colorHex, option, colorMode } = props
  const body = useMemo(() => buildBodyModel(measurements), [measurements])
  const bodyData = useMemo(() => bodyMeshes(body), [body])
  const garmentData = useMemo(
    () => garmentMeshes(buildGarment(body, category, option, colorHex, colorMode)),
    [body, category, option, colorHex, colorMode],
  )
  const fabric = useFabricTexture(CATEGORY_FABRIC[category])
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
          <GarmentMesh key={`garment-${index}`} data={data} fabric={fabric} />
        ))}
      </group>
      <CameraControls targetY={centerY} />
    </Canvas>
  )
}
