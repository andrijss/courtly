import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Float, OrbitControls, Sparkles, useGLTF } from "@react-three/drei";
import tennisCourtModelUrl from "../tennis_court.glb?url";

function TennisCourtModel() {
  const groupRef = useRef(null);
  const { scene } = useGLTF(tennisCourtModelUrl);

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return;
    }
    const elapsed = clock.getElapsedTime();
    groupRef.current.rotation.y = -0.42 + Math.sin(elapsed * 0.36) * 0.08;
    groupRef.current.position.y = -1.12 + Math.sin(elapsed * 0.7) * 0.035;
  });

  return (
    <group ref={groupRef} rotation={[0.05, -0.42, 0]} scale={1.58}>
      <primitive object={scene} />
    </group>
  );
}

export default function LandingCourtScene() {
  return (
    <div className="hero-scene-wrap" aria-label="Interactive 3D tennis court preview">
      <Canvas className="hero-scene" shadows camera={{ position: [3.2, 2.2, 4.2], fov: 38 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <color attach="background" args={["#07100d"]} />
        <fog attach="fog" args={["#07100d", 5, 12]} />
        <ambientLight intensity={0.68} />
        <directionalLight position={[3.6, 5.4, 2.2]} intensity={2.8} color="#fffbe6" castShadow />
        <spotLight position={[-3.4, 4.2, 3.6]} angle={0.42} penumbra={0.55} intensity={2.4} color="#c7e21d" castShadow />
        <pointLight position={[2.4, 0.8, -2.6]} intensity={2.1} color="#7fffd4" />
        <Suspense fallback={null}>
          <Float speed={1.15} rotationIntensity={0.08} floatIntensity={0.16}>
            <TennisCourtModel />
          </Float>
          <ContactShadows position={[0, -1.38, 0]} opacity={0.52} scale={8} blur={2.8} far={4.4} color="#020504" />
          <Sparkles count={34} scale={[5, 2.8, 5]} size={1.25} speed={0.28} color="#c7e21d" opacity={0.5} />
          <Environment preset="city" />
        </Suspense>
        <OrbitControls
          autoRotate
          autoRotateSpeed={0.55}
          enablePan={false}
          minDistance={3.2}
          maxDistance={6.4}
          minPolarAngle={0.82}
          maxPolarAngle={1.38}
        />
      </Canvas>
      <div className="hero-gradient-ring" />
      <div className="scene-hint">Drag to rotate</div>
    </div>
  );
}

useGLTF.preload(tennisCourtModelUrl);
