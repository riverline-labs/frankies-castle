import { OrbitControls, useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  ACESFilmicToneMapping,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PointLight,
} from 'three';
import type { LineWin, SymbolId } from '../game/reels';
import { layout } from './layout';
import { Paylines, ReelColumn, reelWinRows } from './Reels';
import { useBellyTexture, useMarqueeTexture } from './signs';
import { MODEL_URL, useSymbolProtos } from './symbols';

function paint(root: Object3D, name: string, texture: CanvasTexture | null): void {
  if (!texture) return;
  const node = root.getObjectByName(name);
  if (!(node instanceof Mesh)) return;
  const current = node.material;
  if (current instanceof MeshBasicMaterial && current.map === texture) return;
  if (current instanceof MeshBasicMaterial) current.dispose();
  node.material = new MeshBasicMaterial({ map: texture, toneMapped: false });
}

function prepareCabinet(source: Object3D): Object3D {
  const root = source.clone(true);
  const glass = new MeshPhysicalMaterial({
    color: '#e7fff2',
    transmission: 0.2,
    roughness: 0.05,
    thickness: 0.04,
    transparent: true,
    opacity: 0.16,
    metalness: 0,
    depthWrite: false,
    side: DoubleSide,
  });
  const marquee = root.getObjectByName('MarqueePlate');
  if (marquee) marquee.position.z += 0.07;
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const label = `${obj.name} ${obj.parent?.name ?? ''}`;
    if (label.includes('Bulb') || label.includes('Practical')) {
      const mat = (obj.material as MeshStandardMaterial).clone();
      mat.toneMapped = false;
      if (label.includes('Dead')) {
        obj.userData.lamp = 'dead';
        mat.emissive.set('#3a3228');
        mat.emissiveIntensity = 0.05;
      } else if (label.includes('Practical')) {
        obj.userData.lamp = 'practical';
        mat.emissive.set('#9dff7a');
        mat.emissiveIntensity = 2.4;
      } else {
        obj.userData.lamp = 'live';
        mat.emissive.set('#ffd27a');
        mat.emissiveIntensity = 2;
      }
      obj.material = mat;
    }
    if (obj.name === 'ReelGlass' || obj.name === 'BellyGlass') obj.material = glass;
  });
  return root;
}

function Cabinet({ jackpot }: { jackpot: number }) {
  const { scene } = useGLTF(MODEL_URL.cabinet);
  const cab = useMemo(() => prepareCabinet(scene), [scene]);
  const marquee = useMarqueeTexture(jackpot);
  const belly = useBellyTexture();
  useEffect(() => {
    paint(cab, 'MarqueePlate', marquee);
  }, [cab, marquee]);
  useEffect(() => {
    paint(cab, 'BellyPlate', belly);
  }, [cab, belly]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    cab.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      const kind = obj.userData.lamp as string | undefined;
      if (!kind) return;
      const mat = obj.material as MeshStandardMaterial;
      if (kind === 'dead') {
        mat.emissiveIntensity = 0.05;
        return;
      }
      if (kind === 'practical') {
        mat.emissiveIntensity = 2.3 + Math.sin(t * 2.1) * 0.2;
        return;
      }
      const flick = Math.sin(t * (1.6 + (obj.id % 5) * 0.37) + obj.id);
      const dip = flick > 0.93 ? 0.12 : flick > 0.84 ? 0.42 : 1;
      mat.emissiveIntensity = 2.15 * dip * (0.78 + 0.22 * Math.sin(t * 7 + obj.id));
    });
  });
  return <primitive object={cab} />;
}

function Lever({
  disabled,
  pullId,
  onPull,
}: {
  disabled: boolean;
  pullId: number;
  onPull: () => void;
}) {
  const { scene } = useGLTF(MODEL_URL.lever);
  const lever = useMemo(() => scene.clone(true), [scene]);
  const pivot = useRef<Group>(null);
  const anim = useRef<{ t0: number } | null>(null);
  const controls = useThree((state) => state.controls) as { enabled?: boolean } | null;
  useEffect(() => {
    if (pullId === 0) return;
    anim.current = { t0: performance.now() };
  }, [pullId]);
  useFrame(() => {
    const node = pivot.current;
    if (!node) return;
    const run = anim.current;
    if (!run) {
      node.rotation.x = 0;
      return;
    }
    const t = (performance.now() - run.t0) / 1000;
    // Positive X rotation swings the +Y arm toward +Z, into the camera.
    if (t < 0.18) node.rotation.x = (t / 0.18) * 0.95;
    else if (t < 0.52) node.rotation.x = 0.95 * (1 - (t - 0.18) / 0.34);
    else anim.current = null;
  });
  return (
    <group position={layout.lever}>
      <group
        ref={pivot}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (controls) controls.enabled = false;
          if (!disabled) onPull();
        }}
        onPointerUp={() => {
          if (controls) controls.enabled = true;
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = disabled ? 'not-allowed' : 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
          if (controls) controls.enabled = true;
        }}
      >
        <primitive object={lever} />
      </group>
    </group>
  );
}

function Bats({ proto }: { proto: Object3D }) {
  const left = useMemo(() => proto.clone(true), [proto]);
  const right = useMemo(() => proto.clone(true), [proto]);
  const leftRef = useRef<Group>(null);
  const rightRef = useRef<Group>(null);
  useMemo(() => {
    for (const model of [left, right]) model.traverse((obj) => {
      obj.raycast = () => undefined;
    });
  }, [left, right]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (leftRef.current) {
      leftRef.current.position.set(-2.4 + ((t * 0.28) % 4.8), 2.25 + Math.sin(t * 1.3) * 0.08, -0.5);
      leftRef.current.rotation.z = Math.sin(t * 9) * 0.35;
    }
    if (rightRef.current) {
      rightRef.current.position.set(2.4 - ((t * 0.2 + 1.4) % 4.8), 1.9 + Math.sin(t + 1) * 0.1, -0.2);
      rightRef.current.rotation.y = Math.PI;
      rightRef.current.rotation.z = Math.sin(t * 8) * 0.3;
    }
  });
  return (
    <>
      <group ref={leftRef} scale={1.5}>
        <primitive object={left} />
      </group>
      <group ref={rightRef} scale={1.15}>
        <primitive object={right} />
      </group>
    </>
  );
}

function Lightning() {
  const light = useRef<PointLight>(null);
  const next = useRef(performance.now() + 5000);
  useFrame(() => {
    const lamp = light.current;
    if (!lamp) return;
    const now = performance.now();
    if (now > next.current && now < next.current + 140) lamp.intensity = 30;
    else if (now >= next.current + 140 && lamp.intensity > 0) {
      lamp.intensity = 0;
      next.current = now + 8000 + Math.random() * 14000;
    }
  });
  return <pointLight ref={light} position={[0.2, 2.8, 1.4]} color="#d5e4ff" intensity={0} distance={14} />;
}

function CameraRig({ phone }: { phone: boolean }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    const cfg = phone ? layout.cameraPhone : layout.camera;
    camera.position.set(cfg.position[0], cfg.position[1], cfg.position[2]);
    camera.fov = cfg.fov;
    camera.near = 0.08;
    camera.far = 40;
    camera.updateProjectionMatrix();
    camera.lookAt(cfg.target[0], cfg.target[1], cfg.target[2]);
  }, [phone, camera]);
  if (phone) return null;
  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={2.45}
      maxDistance={5.15}
      minPolarAngle={0.95}
      maxPolarAngle={1.42}
      minAzimuthAngle={-0.42}
      maxAzimuthAngle={0.42}
      target={layout.camera.target}
    />
  );
}

function Stage({
  phone,
  grid,
  previous,
  spinId,
  lines,
  jackpot,
  leverDisabled,
  pullId,
  onPull,
}: {
  phone: boolean;
  grid: SymbolId[][];
  previous: SymbolId[][];
  spinId: number;
  lines: LineWin[];
  jackpot: number;
  leverDisabled: boolean;
  pullId: number;
  onPull: () => void;
}) {
  const protos = useSymbolProtos();
  return (
    <>
      <CameraRig phone={phone} />
      <color attach="background" args={['#070812']} />
      <fog attach="fog" args={['#070812', 4.4, 10]} />
      <ambientLight intensity={0.32} color="#b1abd4" />
      <directionalLight position={[-2.6, 3.6, 2.8]} intensity={0.85} color="#ffe2b5" />
      <directionalLight position={[2.4, 1.5, -1.2]} intensity={0.22} color="#6e62b5" />
      <pointLight position={[0, 2.35, 1.15]} intensity={2.2} distance={4.2} color="#ffd7a0" decay={2} />
      <pointLight position={[0, 1.25, 1.15]} intensity={1.15} distance={2.4} color="#c8ffb0" decay={2} />
      <Lightning />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[7, 48]} />
        <meshStandardMaterial color="#10121a" roughness={0.96} metalness={0.04} />
      </mesh>
      <mesh position={[0, 1.5, -1.85]}>
        <planeGeometry args={[12, 4.6]} />
        <meshStandardMaterial color="#0c0d16" roughness={1} />
      </mesh>
      <Cabinet jackpot={jackpot} />
      {grid.map((column, reel) => (
        <ReelColumn
          key={reel}
          reelIndex={reel}
          result={column}
          previous={previous[reel]}
          spinId={spinId}
          wins={reelWinRows(lines, reel)}
          protos={protos}
        />
      ))}
      <Paylines lines={lines} />
      {[0, 1, 2, 3].map((index) => {
        const mid = (layout.reelX[index] + layout.reelX[index + 1]) / 2;
        return (
          <mesh key={index} position={[mid, layout.reelCenterY, layout.reelZ + 0.055]}>
            <boxGeometry args={[0.012, layout.cell * 3.05, 0.03]} />
            <meshStandardMaterial color="#8a7040" metalness={0.9} roughness={0.35} />
          </mesh>
        );
      })}
      <Lever disabled={leverDisabled} pullId={pullId} onPull={onPull} />
      <Bats proto={protos.bat} />
    </>
  );
}

export function Machine(props: {
  phone: boolean;
  grid: SymbolId[][];
  previous: SymbolId[][];
  spinId: number;
  lines: LineWin[];
  jackpot: number;
  leverDisabled: boolean;
  pullId: number;
  onPull: () => void;
  onReady: () => void;
}) {
  const { onReady, ...stage } = props;
  useEffect(() => {
    onReady();
  }, [onReady]);
  return <Stage {...stage} />;
}

export function configureRenderer(gl: { toneMapping: number; toneMappingExposure: number; setClearColor: (c: string) => void }): void {
  gl.toneMapping = ACESFilmicToneMapping;
  gl.toneMappingExposure = 0.92;
  gl.setClearColor('#070812');
}
