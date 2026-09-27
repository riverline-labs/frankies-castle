import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { buildStrip, idleStrip, reelPath, reelTiming, sampleReelY } from '../game/motion';
import { pickSymbol, SYMBOL_COLOR, type LineWin, type SymbolId } from '../game/reels';
import { layout } from './layout';

function rowOf(index: number, length: number): number | null {
  if (index === length - 1) return 0;
  if (index === length - 2) return 1;
  if (index === length - 3) return 2;
  return null;
}

function SymbolModel({ proto, win, color }: { proto: Object3D; win: boolean; color: string }) {
  const model = useMemo(() => {
    const clone = proto.clone(true);
    const mats: MeshStandardMaterial[] = [];
    clone.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      const clones = list.map((mat) => {
        const copy = mat.clone();
        if (copy instanceof MeshStandardMaterial) mats.push(copy);
        return copy;
      });
      obj.material = clones.length === 1 ? clones[0] : clones;
    });
    clone.userData.mats = mats;
    return clone;
  }, [proto]);

  useFrame(({ clock }) => {
    const mats = model.userData.mats as MeshStandardMaterial[];
    const amount = win ? 0.65 + Math.sin(clock.elapsedTime * 7) * 0.35 : 0;
    for (const mat of mats) {
      if (!mat.userData.baseEmissive) {
        mat.userData.baseEmissive = mat.emissive.clone();
        mat.userData.baseIntensity = mat.emissiveIntensity;
      }
      if (amount === 0) {
        mat.emissive.copy(mat.userData.baseEmissive as Color);
        mat.emissiveIntensity = mat.userData.baseIntensity as number;
      } else {
        mat.emissive.set(color);
        mat.emissiveIntensity = Math.max(amount, mat.userData.baseIntensity as number);
      }
    }
  });

  return <primitive object={model} position={[0, 0, 0.02]} />;
}

function Card({
  id,
  proto,
  index,
  length,
  wins,
  spinning,
}: {
  id: SymbolId;
  proto: Object3D;
  index: number;
  length: number;
  wins: ReadonlySet<number>;
  spinning: boolean;
}) {
  const row = rowOf(index, length);
  const win = !spinning && row !== null && wins.has(row);
  const color = SYMBOL_COLOR[id];
  const plate = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#14151e',
        metalness: 0.42,
        roughness: 0.48,
        emissive: new Color(color),
        emissiveIntensity: 0,
      }),
    [color],
  );
  useFrame(({ clock }) => {
    plate.emissive.set(color);
    plate.emissiveIntensity = win ? 0.4 + Math.sin(clock.elapsedTime * 7) * 0.25 : 0;
  });
  return (
    <group position={[0, index * layout.cell, 0]}>
      <mesh material={plate}>
        <boxGeometry args={[0.2, 0.198, 0.012]} />
      </mesh>
      <SymbolModel proto={proto} win={win} color={color} />
    </group>
  );
}

export function ReelColumn({
  reelIndex,
  result,
  previous,
  spinId,
  wins,
  protos,
}: {
  reelIndex: number;
  result: readonly SymbolId[];
  previous: readonly SymbolId[];
  spinId: number;
  wins: ReadonlySet<number>;
  protos: Record<SymbolId, Object3D>;
}) {
  const group = useRef<Group>(null);
  const stripRef = useRef<SymbolId[]>(idleStrip(result));
  const anim = useRef<{ t0: number; running: boolean } | null>(null);
  const seen = useRef(-1);
  const spinning = useRef(false);

  if (seen.current !== spinId) {
    seen.current = spinId;
    if (spinId === 0) {
      stripRef.current = idleStrip(result);
      anim.current = null;
    } else {
      stripRef.current = buildStrip(previous, result, 10 + reelIndex * 3, () => pickSymbol(Math.random));
      anim.current = { t0: performance.now(), running: true };
    }
  }

  useLayoutEffect(() => {
    const node = group.current;
    if (!node) return;
    node.position.x = layout.reelX[reelIndex];
    node.position.z = layout.reelZ;
    const path = reelPath(layout.reelCenterY, stripRef.current.length, layout.cell);
    node.position.y = anim.current?.running ? path.startY : path.endY;
  }, [spinId, reelIndex]);

  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const length = stripRef.current.length;
    const path = reelPath(layout.reelCenterY, length, layout.cell);
    let y = path.endY;
    const run = anim.current;
    if (run?.running) {
      const timing = reelTiming(reelIndex);
      const elapsed = (performance.now() - run.t0) / 1000 - timing.delay;
      if (elapsed < 0) y = path.startY;
      else {
        const t = Math.min(1, elapsed / timing.duration);
        y = sampleReelY(path, t, layout.cell, reelIndex === 4);
        if (t >= 1) run.running = false;
      }
    }
    spinning.current = Boolean(run?.running);
    node.position.y = y;
    node.children.forEach((child, index) => {
      const worldY = y + index * layout.cell;
      child.visible = Math.abs(worldY - layout.reelCenterY) < layout.cell * 1.7;
    });
  });

  const strip = stripRef.current;
  return (
    <group ref={group}>
      {strip.map((id, index) => (
        <Card
          key={`${spinId}-${index}-${id}`}
          id={id}
          proto={protos[id]}
          index={index}
          length={strip.length}
          wins={wins}
          spinning={spinId > seen.current ? true : spinning.current}
        />
      ))}
    </group>
  );
}

function GlowSegment({ a, b, color }: { a: [number, number, number]; b: [number, number, number]; color: string }) {
  const pose = useMemo(() => {
    const start = new Vector3(...a);
    const end = new Vector3(...b);
    const dir = end.clone().sub(start);
    const length = Math.max(dir.length(), 0.001);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
    return { mid, quaternion, length };
  }, [a, b]);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.4,
        toneMapped: false,
      }),
    [color],
  );
  useFrame(({ clock }) => {
    material.emissiveIntensity = 1.05 + Math.sin(clock.elapsedTime * 6) * 0.45;
  });
  return (
    <mesh position={pose.mid} quaternion={pose.quaternion} material={material}>
      <cylinderGeometry args={[0.012, 0.012, pose.length, 6]} />
    </mesh>
  );
}

export function Paylines({ lines }: { lines: LineWin[] }) {
  const segments = useMemo(() => {
    const out: { a: [number, number, number]; b: [number, number, number]; color: string; key: string }[] = [];
    lines.forEach((line, lineIndex) => {
      const points = line.full.map(([reel, row]) => {
        const point: [number, number, number] = [
          layout.reelX[reel],
          layout.reelCenterY + (1 - row) * layout.cell,
          layout.reelZ + 0.16,
        ];
        return point;
      });
      for (let i = 0; i < points.length - 1; i += 1) {
        out.push({
          a: points[i],
          b: points[i + 1],
          color: SYMBOL_COLOR[line.symbolId],
          key: `${lineIndex}-${i}`,
        });
      }
    });
    return out;
  }, [lines]);
  return (
    <group>
      {segments.map((segment) => (
        <GlowSegment key={segment.key} a={segment.a} b={segment.b} color={segment.color} />
      ))}
    </group>
  );
}

export function reelWinRows(lines: LineWin[], reelIndex: number): Set<number> {
  const rows = new Set<number>();
  for (const line of lines) {
    for (const [reel, row] of line.cells) {
      if (reel === reelIndex) rows.add(row);
    }
  }
  return rows;
}
