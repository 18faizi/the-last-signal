/**
 * Threat visual props builder (Milestone 0.9): the pooled silhouette
 * assemblies, authored light fixtures and the duty-phone indicator.
 *
 * TWO pooled silhouette assemblies are built ONCE at scene creation and
 * only ever hidden/shown/repositioned afterwards — one for manifestations
 * (staged presentation beats) and one for the active threat actor. They are
 * never re-created per event (pooling constraint), never pickable, and have
 * no physics bodies (kinematic transforms only — nothing can tumble).
 *
 * The silhouette is a deliberately provisional, tall human-LIKE shape from
 * primitives: dark desaturated material, slightly off proportions (narrow
 * torso, small head, over-long arms), no face, no gore, no creature
 * features.
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import {
  FACILITY_THREAT_FIXTURES,
  type ThreatLightFixtureDefinition,
} from './facilityThreatDefinitions';

export type ThreatLightMode = 'on' | 'off' | 'blink' | 'cut';

export interface SilhouetteHandle {
  readonly root: TransformNode;
  setVisible(visible: boolean): void;
  setTransform(x: number, y: number, z: number, yaw: number): void;
  readonly isVisible: boolean;
  /** All meshes of the assembly (LOS-probe exclusion set). */
  readonly meshes: readonly Mesh[];
}

export interface ThreatLightHandle {
  readonly id: string;
  setMode(mode: ThreatLightMode): void;
  readonly mode: ThreatLightMode;
  /** Ticked from the threat bindings' always-on observer (blink phase). */
  tick(deltaSeconds: number): void;
}

export interface ThreatPropsHandle {
  readonly manifestationSilhouette: SilhouetteHandle;
  readonly actorSilhouette: SilhouetteHandle;
  readonly lights: ReadonlyMap<string, ThreatLightHandle>;
  /** Every prop mesh the LOS probe must ignore. */
  readonly losExcludedMeshes: ReadonlySet<Mesh>;
  reset(): void;
  dispose(): void;
}

function buildSilhouette(scene: Scene, name: string): SilhouetteHandle {
  const root = new TransformNode(`${name}-root`, scene);

  const material = new StandardMaterial(`${name}-mat`, scene);
  material.diffuseColor = new Color3(0.07, 0.075, 0.09);
  material.specularColor = new Color3(0, 0, 0);
  material.emissiveColor = new Color3(0.015, 0.015, 0.02);

  const meshes: Mesh[] = [];
  const part = (mesh: Mesh, x: number, y: number, z: number): Mesh => {
    mesh.material = material;
    mesh.isPickable = false;
    mesh.parent = root;
    mesh.position.set(x, y, z);
    meshes.push(mesh);
    return mesh;
  };

  // Slightly-off proportions: narrow torso, small head, long arms.
  part(CreateBox(`${name}-legs`, { width: 0.34, height: 0.86, depth: 0.22 }, scene), 0, 0.43, 0);
  part(CreateBox(`${name}-torso`, { width: 0.42, height: 0.78, depth: 0.24 }, scene), 0, 1.25, 0);
  part(CreateSphere(`${name}-head`, { diameter: 0.21, segments: 8 }, scene), 0, 1.78, 0);
  part(
    CreateBox(`${name}-arm-l`, { width: 0.09, height: 0.82, depth: 0.11 }, scene),
    -0.28,
    1.18,
    0,
  );
  part(
    CreateBox(`${name}-arm-r`, { width: 0.09, height: 0.82, depth: 0.11 }, scene),
    0.28,
    1.18,
    0,
  );

  root.setEnabled(false);

  let visible = false;
  return {
    root,
    get isVisible(): boolean {
      return visible;
    },
    meshes,
    setVisible(v: boolean): void {
      if (v === visible) return;
      visible = v;
      root.setEnabled(v);
    },
    setTransform(x: number, y: number, z: number, yaw: number): void {
      root.position.set(x, y, z);
      root.rotation.y = yaw;
    },
  };
}

const BLINK_INTERVAL_SECONDS = 0.45;

function buildLightFixture(
  scene: Scene,
  def: ThreatLightFixtureDefinition,
): { handle: ThreatLightHandle; mesh: Mesh } {
  const mesh = CreateBox(`fg-threat-light-${def.id}`, { size: 0.28 }, scene);
  mesh.position.set(def.position.x, def.position.y, def.position.z);
  mesh.isPickable = false;
  const material = new StandardMaterial(`fg-threat-light-mat-${def.id}`, scene);
  const onColor = new Color3(def.color.r, def.color.g, def.color.b);
  material.diffuseColor = new Color3(0.1, 0.1, 0.1);
  material.specularColor = new Color3(0, 0, 0);
  mesh.material = material;

  let mode: ThreatLightMode = def.initiallyOn ? 'on' : 'off';
  let blinkAccumulator = 0;
  let blinkLit = false;

  const applyLit = (lit: boolean): void => {
    material.emissiveColor = lit ? onColor : new Color3(0.01, 0.01, 0.01);
  };
  applyLit(mode === 'on');

  const handle: ThreatLightHandle = {
    id: def.id,
    get mode(): ThreatLightMode {
      return mode;
    },
    setMode(next: ThreatLightMode): void {
      mode = next;
      blinkAccumulator = 0;
      if (next === 'on') applyLit(true);
      else if (next === 'off' || next === 'cut') applyLit(false);
      else {
        blinkLit = true;
        applyLit(true);
      }
    },
    tick(deltaSeconds: number): void {
      if (mode !== 'blink') return;
      blinkAccumulator += deltaSeconds;
      if (blinkAccumulator >= BLINK_INTERVAL_SECONDS) {
        blinkAccumulator -= BLINK_INTERVAL_SECONDS;
        blinkLit = !blinkLit;
        applyLit(blinkLit);
      }
    },
  };
  return { handle, mesh };
}

export function buildThreatProps(ctx: FacilitySceneContext, scene: Scene): ThreatPropsHandle {
  const manifestationSilhouette = buildSilhouette(scene, 'fg-threat-manifest');
  const actorSilhouette = buildSilhouette(scene, 'fg-threat-actor');

  const lights = new Map<string, ThreatLightHandle>();
  const losExcludedMeshes = new Set<Mesh>();
  for (const mesh of manifestationSilhouette.meshes) losExcludedMeshes.add(mesh);
  for (const mesh of actorSilhouette.meshes) losExcludedMeshes.add(mesh);

  const fixtureMeshes: Mesh[] = [];
  for (const def of FACILITY_THREAT_FIXTURES) {
    const { handle, mesh } = buildLightFixture(scene, def);
    lights.set(def.id, handle);
    losExcludedMeshes.add(mesh);
    fixtureMeshes.push(mesh);
  }

  // Label the duty phone so the fixture reads as a phone placeholder.
  ctx.geo.label('DUTY PHONE', new Vector3(3, 1.45, 17.3), 1);

  return {
    manifestationSilhouette,
    actorSilhouette,
    lights,
    losExcludedMeshes,
    reset(): void {
      manifestationSilhouette.setVisible(false);
      actorSilhouette.setVisible(false);
      for (const def of FACILITY_THREAT_FIXTURES) {
        lights.get(def.id)?.setMode(def.initiallyOn ? 'on' : 'off');
      }
    },
    dispose(): void {
      for (const mesh of fixtureMeshes) mesh.dispose(false, true);
      for (const mesh of manifestationSilhouette.meshes) mesh.dispose(false, true);
      for (const mesh of actorSilhouette.meshes) mesh.dispose(false, true);
      manifestationSilhouette.root.dispose();
      actorSilhouette.root.dispose();
    },
  };
}
