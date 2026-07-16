/**
 * Generator hall control panel geometry: fuel valve, starter battery
 * isolator, emergency stop, mode selector, starter control, main breaker and
 * status panel — mounted on the generator hall's north interior wall.
 *
 * Wires GeneratorController (pure) into the scene via
 * GeneratorInteractionTargets (the sanctioned Babylon-facing adapter),
 * registers the seven resulting InteractionTargets, and connects the
 * generator's power output to PowerNetwork's generator source + the
 * generator-auxiliary circuit via EmergencyPowerController /
 * BreakerController wiring performed by the scene (see
 * FacilityGreyboxScene.ts) — this builder only constructs geometry and
 * interaction targets.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import {
  createGeneratorInteractionTargets,
  type GeneratorControlMeshes,
} from '../../../game/generator/GeneratorInteractionTargets';

function box(scene: Scene, id: string, position: Vector3, size: Vector3, color: Color3) {
  const mesh = CreateBox(id, { width: size.x, height: size.y, depth: size.z }, scene);
  mesh.position.copyFrom(position);
  const mat = new StandardMaterial(`${id}-mat`, scene);
  mat.diffuseColor = color;
  mat.specularColor = new Color3(0.05, 0.05, 0.05);
  mesh.material = mat;
  mesh.isPickable = true;
  return mesh;
}

export function buildGeneratorControls(ctx: FacilitySceneContext, scene: Scene): void {
  const wallZ = 5.75; // just inside the north wall (z = 6)
  // Aligned to the player's standing eye height (1.66m, see PlayerConfig) so
  // a level forward look (pitch 0) lands on the controls from a normal
  // standing position — this is what lets the e2e suite drive the starter
  // hold through the real interaction framework instead of a bridge shortcut.
  const y = 1.6;

  const meshes: GeneratorControlMeshes = {
    statusPanel: box(
      scene,
      'fg-gen-status-panel',
      new Vector3(43.5, y + 0.3, wallZ),
      new Vector3(0.8, 0.6, 0.12),
      new Color3(0.15, 0.5, 0.6),
    ),
    fuelValve: box(
      scene,
      'fg-gen-fuel-valve',
      new Vector3(45, y, wallZ),
      new Vector3(0.35, 0.35, 0.25),
      new Color3(0.55, 0.4, 0.15),
    ),
    // Battery/e-stop/selector originally used height 0.3 (top edge at
    // y=1.75), which sits just below the camera's actual settled eye height
    // (~1.77-1.78, footHeight + PlayerConfig.standingEyeHeight — a few
    // centimetres above the nominal 1.66 once floor collision settles). A
    // level (pitch 0) ray at eye height passed clean over the top of these
    // three boxes and never hit them — confirmed by dumping live mesh and
    // camera positions: mesh position and camera position were exactly as
    // expected, but the box's vertical extent didn't reach the ray. Bumped
    // to height 0.5 (matching the breaker, which never exhibited the miss)
    // for a comfortable margin above the observed eye height.
    battery: box(
      scene,
      'fg-gen-battery-isolator',
      new Vector3(46, y, wallZ),
      new Vector3(0.4, 0.5, 0.2),
      new Color3(0.2, 0.45, 0.2),
    ),
    emergencyStop: box(
      scene,
      'fg-gen-estop',
      new Vector3(47, y, wallZ),
      new Vector3(0.3, 0.5, 0.25),
      new Color3(0.65, 0.1, 0.1),
    ),
    selector: box(
      scene,
      'fg-gen-selector',
      new Vector3(48, y, wallZ),
      new Vector3(0.3, 0.5, 0.2),
      new Color3(0.5, 0.5, 0.15),
    ),
    // The starter alone is held continuously for several real seconds (the
    // 2-second hold, stretched further by degraded headless frame pacing —
    // see tests/e2e/power.spec.ts's holdStarterUntilCranked). Over that
    // span the character controller's slow post-teleport settle (Havok
    // resolving the small gap between the y=0.1 teleport target and the
    // floor's actual rest height) creeps the camera's eye height upward by
    // several centimetres, asymptotically approaching ~1.81 — the original
    // height 0.4 (top edge 1.8) sat right at that ceiling, so a long hold
    // could drift the ray just past the box's top and drop it. Bumped to
    // 0.6 (top edge 1.9) for comfortable margin over the observed asymptote.
    starter: box(
      scene,
      'fg-gen-starter',
      new Vector3(49, y, wallZ),
      new Vector3(0.35, 0.6, 0.25),
      new Color3(0.6, 0.6, 0.6),
    ),
    breaker: box(
      scene,
      'fg-gen-main-breaker',
      new Vector3(50, y, wallZ),
      new Vector3(0.4, 0.5, 0.25),
      new Color3(0.15, 0.15, 0.5),
    ),
  };

  const targets = createGeneratorInteractionTargets(
    'fg-gen-ctrl',
    ctx.generatorController,
    scene,
    meshes,
  );
  for (const target of targets) {
    ctx.interactionRegistry.register(target);
  }

  ctx.geo.label('GENERATOR CONTROLS', new Vector3(47, 2.2, wallZ), 3);
}
