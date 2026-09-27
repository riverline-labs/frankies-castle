import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import {
  Box3,
  DoubleSide,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import type { SymbolId } from '../game/reels';

export const MODEL_URL: Record<SymbolId | 'cabinet' | 'lever', string> = {
  wolf: '/models/wolf.glb',
  moth: '/models/moth.glb',
  bat: '/models/bat.glb',
  bride: '/models/bride.glb',
  creature: '/models/creature.glb',
  crow: '/models/elixir.glb',
  frank: '/models/frank.glb',
  cabinet: '/models/cabinet.glb',
  lever: '/models/lever.glb',
};

for (const url of Object.values(MODEL_URL)) useGLTF.preload(url);

function tuneSymbolMaterials(root: Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const list = Array.isArray(obj.material) ? obj.material : [obj.material];
    const next = list.map((mat) => {
      if (mat.name === 'ElixirGlass' || mat.name === 'BrideVeil') {
        return new MeshPhysicalMaterial({
          name: mat.name,
          color: mat.name === 'BrideVeil' ? '#f3f0ea' : '#e9fff0',
          transmission: mat.name === 'BrideVeil' ? 0.22 : 0.9,
          thickness: 0.15,
          roughness: 0.06,
          metalness: 0,
          transparent: true,
          opacity: mat.name === 'BrideVeil' ? 0.8 : 1,
          ior: 1.45,
          depthWrite: mat.name !== 'BrideVeil',
          side: DoubleSide,
        });
      }
      if (mat instanceof MeshStandardMaterial) {
        if (mat.name === 'MothWing' || mat.name === 'MothMark' || mat.name === 'BatWing') {
          mat.side = DoubleSide;
        }
      }
      return mat;
    });
    obj.material = next.length === 1 ? next[0] : next;
    obj.castShadow = false;
    obj.receiveShadow = false;
  });
}

/** Fit a symbol to the reel card. Depth is capped so snouts stay behind the glass. */
export function fitSymbol(source: Object3D): Object3D {
  const root = source.clone(true);
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const list = Array.isArray(obj.material) ? obj.material : [obj.material];
    const clones = list.map((mat) => mat.clone());
    obj.material = clones.length === 1 ? clones[0] : clones;
  });
  tuneSymbolMaterials(root);
  root.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const s = Math.min(0.168 / Math.max(size.y, 1e-4), 0.2 / Math.max(size.x, 1e-4));
  const zScale = size.z * s > 0.085 ? 0.085 / Math.max(size.z, 1e-4) : s;
  root.scale.set(s, s, zScale);
  root.position.set(-center.x * s, -center.y * s, -center.z * zScale);
  return root;
}

export function useSymbolProtos(): Record<SymbolId, Object3D> {
  const wolf = useGLTF(MODEL_URL.wolf);
  const moth = useGLTF(MODEL_URL.moth);
  const bat = useGLTF(MODEL_URL.bat);
  const bride = useGLTF(MODEL_URL.bride);
  const creature = useGLTF(MODEL_URL.creature);
  const crow = useGLTF(MODEL_URL.crow);
  const frank = useGLTF(MODEL_URL.frank);
  return useMemo(
    () => ({
      wolf: fitSymbol(wolf.scene),
      moth: fitSymbol(moth.scene),
      bat: fitSymbol(bat.scene),
      bride: fitSymbol(bride.scene),
      creature: fitSymbol(creature.scene),
      crow: fitSymbol(crow.scene),
      frank: fitSymbol(frank.scene),
    }),
    [wolf.scene, moth.scene, bat.scene, bride.scene, creature.scene, crow.scene, frank.scene],
  );
}
