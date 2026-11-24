// 3D-сцена примерочной: процедурный манекен по меркам и вещь выбранного размера.
// Загружается лениво (React.lazy), чтобы three.js не утяжелял остальные страницы.
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { SizeOption } from '../../types/analysis'
import type { Measurements } from '../../types/body'
import type { Category } from '../../types/catalog'
import type { MeshData } from '../avatar/loft'
import { buildBodyModel } from '../avatar/sections'
import { MANNEQUIN_HEX } from './colors'
import { buildGarment, type ColorMode } from './garment'
import { bodyMeshes, garmentMeshes } from './scene'

/** Сантиметры модели → метры сцены. */
const CM_TO_M = 0.01

export interface FittingSceneProps {
  measurements: Measurements
  category: Category
  colorHex: string
  option: SizeOption
  colorMode: ColorMode
}

/** Сетка из готовых массивов; геометрия освобождается при смене данных. */
function DataMesh({ data }: { data: MeshData }) {
  const geometry = useMemo(() => {
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(data.positions, 3))
    result.setAttribute('color', new BufferAttribute(data.colors, 3))
    result.setIndex(new BufferAttribute(data.indices, 1))
    result.computeVertexNormals()
    return result
  }, [data])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors side={DoubleSide} roughness={0.85} />
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
    controls.update()
    return () => controls.dispose()
  }, [camera, canvas, targetY])
  return null
}

/** Сцена: свет, манекен, вещь и вращение камеры пальцем или мышью. */
export default function FittingScene(props: FittingSceneProps) {
  const { measurements, category, colorHex, option, colorMode } = props
  const body = useMemo(() => buildBodyModel(measurements), [measurements])
  const bodyData = useMemo(() => bodyMeshes(body), [body])
  const garmentData = useMemo(
    () => garmentMeshes(buildGarment(body, category, option, colorHex, colorMode)),
    [body, category, option, colorHex, colorMode],
  )
  const centerY = body.heightCm * 0.55 * CM_TO_M
  return (
    <Canvas camera={{ position: [0, centerY, 2.6], fov: 40 }} dpr={[1, 2]}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 2]} intensity={1.6} />
      <directionalLight position={[-2, 1, -2]} intensity={0.5} />
      <group scale={CM_TO_M}>
        {bodyData.map((data, index) => (
          <DataMesh key={`body-${index}`} data={data} />
        ))}
        <mesh position={[0, body.head.y, 0]}>
          <sphereGeometry args={[body.head.radius, 32, 24]} />
          <meshStandardMaterial color={MANNEQUIN_HEX} roughness={0.85} />
        </mesh>
        {garmentData.map((data, index) => (
          <DataMesh key={`garment-${index}`} data={data} />
        ))}
      </group>
      <CameraControls targetY={centerY} />
    </Canvas>
  )
}
