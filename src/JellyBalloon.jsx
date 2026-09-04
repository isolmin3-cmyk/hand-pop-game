import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Float, OrbitControls, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

const palette = ['#ff5f87', '#ff9138', '#7664ff', '#2fc8a8', '#49a5ff']

function Balloon({ round, popping, onPop }) {
  const group = useRef()
  const body = useRef()
  const burst = useRef()
  const color = palette[round % palette.length]
  const targetRotation = useRef(0)

  const particles = useMemo(() => {
    return Array.from({ length: 18 }, (_, index) => {
      const angle = (index / 18) * Math.PI * 2
      return {
        direction: new THREE.Vector3(Math.cos(angle), Math.sin(angle), (index % 3 - 1) * 0.35).normalize(),
        color: palette[index % palette.length],
      }
    })
  }, [])

  useEffect(() => {
    group.current?.scale.set(1, 1, 1)
    if (!burst.current) return
    burst.current.children.forEach((particle) => {
      particle.position.set(0, 0.2, 0)
      particle.scale.setScalar(0)
      particle.visible = false
    })
  }, [round])

  useFrame((state, delta) => {
    if (!group.current || !body.current) return
    const time = state.clock.elapsedTime
    targetRotation.current += delta * 0.16
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetRotation.current, 0.03)

    if (!popping) {
      const squash = Math.sin(time * 2.5) * 0.025
      body.current.scale.x = THREE.MathUtils.lerp(body.current.scale.x, 1 + squash, 0.12)
      body.current.scale.y = THREE.MathUtils.lerp(body.current.scale.y, 1 - squash, 0.12)
      body.current.scale.z = THREE.MathUtils.lerp(body.current.scale.z, 1 + squash, 0.12)
      group.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.12)
      return
    }

    group.current.scale.multiplyScalar(Math.pow(0.005, delta))
    burst.current?.children.forEach((particle, index) => {
      particle.visible = true
      particle.scale.setScalar(Math.min(1, particle.scale.x + delta * 8))
      particle.position.addScaledVector(particles[index].direction, delta * 4.2)
      particle.rotation.x += delta * 5
      particle.rotation.y += delta * 7
    })
  })

  return (
    <group>
      <Float speed={2} rotationIntensity={0.16} floatIntensity={0.45}>
        <group ref={group} position={[0, 0.15, 0]} onClick={(event) => { event.stopPropagation(); onPop() }}>
          <mesh ref={body} scale={[1, 1.18, 1]} castShadow>
            <sphereGeometry args={[1.05, 64, 64]} />
            <meshPhysicalMaterial color={color} roughness={0.22} metalness={0.02} clearcoat={1} clearcoatRoughness={0.14} transmission={0.04} thickness={1.1} />
          </mesh>
          <mesh position={[-0.35, 0.45, 0.88]} rotation={[0.2, -0.2, -0.3]}>
            <sphereGeometry args={[0.17, 24, 24]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.68} />
          </mesh>
          <mesh position={[0, -1.17, 0]} rotation={[0, 0, Math.PI]} castShadow>
            <coneGeometry args={[0.2, 0.34, 24]} />
            <meshStandardMaterial color={color} roughness={0.35} />
          </mesh>
          <mesh position={[0.04, -1.82, 0]}>
            <tubeGeometry args={[new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.48, 0), new THREE.Vector3(-0.12, 0.05, 0), new THREE.Vector3(0.1, -0.4, 0)]), 24, 0.018, 8, false]} />
            <meshStandardMaterial color="#40364f" roughness={0.8} />
          </mesh>
        </group>
      </Float>

      <group ref={burst}>
        {particles.map((particle, index) => (
          <mesh key={index} visible={false}>
            <tetrahedronGeometry args={[0.11, 0]} />
            <meshStandardMaterial color={particle.color} roughness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default function JellyBalloon({ round, popping, onPop }) {
  return (
    <div className="three-stage" aria-label="드래그해서 돌려볼 수 있는 3D 젤리 풍선">
      <Canvas dpr={[1, 1.7]} camera={{ position: [0, 0.15, 5.2], fov: 42 }} gl={{ antialias: true, alpha: true }} shadows>
        <ambientLight intensity={1.4} />
        <directionalLight position={[3, 5, 4]} intensity={3.2} castShadow />
        <pointLight position={[-3, 0, 3]} intensity={6} color="#d7c8ff" />
        <Balloon round={round} popping={popping} onPop={onPop} />
        <Sparkles count={28} scale={[5, 3.5, 2]} size={2.2} speed={0.28} opacity={0.65} color="#ffffff" />
        <ContactShadows position={[0, -2.25, 0]} opacity={0.26} scale={6} blur={2.8} far={4} />
        <Environment preset="studio" />
        <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 2.5} maxPolarAngle={Math.PI / 1.65} />
      </Canvas>
    </div>
  )
}
