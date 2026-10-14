// The 3D canvas (loaded on demand). React Three Fiber hosts the renderer and the frame
// loop; the world itself is plain three.js from world.ts.
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { progress } from './store';
import { layoutFor } from './trajectory';
import { createWorld, type Quality } from './world';

export type Stage = 1 | 2 | 3; // code loaded · world built · first frame drawn

type Props = {
  motion: boolean;
  quality: Quality;
  running: boolean;
  onStage: (s: Stage) => void;
  onLost: () => void;
};

function WorldNode({ motion, quality, running, onStage }: Pick<Props, 'motion' | 'quality' | 'running' | 'onStage'>) {
  const { gl, scene, camera, size, invalidate } = useThree();
  const world = useMemo(() => createWorld({ quality }), [quality]);
  const drawn = useRef(false);
  const payload = useMemo(() => new URLSearchParams(location.search).has('payload'), []);

  useEffect(() => {
    onStage(2);
    scene.add(world.scene);
    scene.fog = world.fog;
    const env = world.environment(gl);
    scene.environment = env;
    scene.environmentIntensity = 1.0;
    invalidate();
    const off = progress.subscribe(() => invalidate());
    return () => {
      off();
      scene.remove(world.scene);
      scene.environment = null;
      env.dispose();
    };
  }, [world, gl, scene, invalidate, onStage]);
  // back on screen: draw the current position at once (the scroll may have moved meanwhile)
  useEffect(() => { if (running) invalidate(); }, [running, invalidate]);

  useFrame((state) => {
    world.update({
      p: progress.get(),
      layout: layoutFor(size.width / size.height),
      time: state.clock.elapsedTime,
      motion,
      payload,
      camera: camera as THREE.PerspectiveCamera,
      width: size.width,
      height: size.height,
    });
    if (!drawn.current) {
      drawn.current = true;
      requestAnimationFrame(() => onStage(3));
    }
  });
  return null;
}

export default function Scene({ motion, quality, running, onStage, onLost }: Props) {
  useEffect(() => onStage(1), [onStage]);
  return (
    <Canvas
      className="stage-canvas"
      dpr={quality === 'high' ? [1, 2] : [1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false, preserveDrawingBuffer: false }}
      shadows="soft"
      camera={{ fov: 32, near: 0.05, far: 11000 }}
      frameloop={running ? (motion ? 'always' : 'demand') : 'never'}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.AgXToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.setClearColor('#071321');
        gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onLost(); });
      }}
    >
      <WorldNode motion={motion} quality={quality} running={running} onStage={onStage} />
    </Canvas>
  );
}
