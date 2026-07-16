/**
 * Indicator lights / powered-zone markers across the facility, wired to
 * PoweredStateBinding so each zone visibly reflects its circuit's power
 * state — a small emissive lamp plus a real PointLight per circuit, dim/dark
 * until energized.
 *
 * Returns the created bindings so the scene can dispose them on teardown
 * (they are plain PowerNetwork subscriptions, not owned by any InteractionTarget).
 */
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { bindEmissiveToCircuit, bindLightToCircuit } from './facilityPowerBindings';
import type { PoweredStateBinding } from '../../../game/electrical/PoweredStateBinding';
import {
  CIRCUIT_EMERGENCY_SECURITY_ID,
  CIRCUIT_GENERATOR_AUXILIARY_ID,
  CIRCUIT_TUNNEL_ID,
  CIRCUIT_STAFF_QUARTERS_ID,
  CIRCUIT_ROOFTOP_ANTENNA_ID,
  CIRCUIT_ARCHIVE_ID,
} from './facilityPowerDefinitions';
import type { PowerCircuitId } from '../../../game/power/PowerCircuitId';

interface IndicatorSpec {
  readonly id: string;
  readonly circuitId: PowerCircuitId;
  readonly position: Vector3;
  readonly color: Color3;
  readonly lightIntensity: number;
}

/** Exported so the F10 debug overlay can place matching markers. */
export const INDICATORS: readonly IndicatorSpec[] = [
  {
    id: 'fg-indicator-security',
    circuitId: CIRCUIT_EMERGENCY_SECURITY_ID,
    position: new Vector3(-16, 3, 6),
    color: new Color3(0.9, 0.2, 0.2),
    lightIntensity: 0.4,
  },
  {
    id: 'fg-indicator-generator-hall',
    circuitId: CIRCUIT_GENERATOR_AUXILIARY_ID,
    position: new Vector3(47, 3.6, 2),
    color: new Color3(0.9, 0.8, 0.3),
    lightIntensity: 0.6,
  },
  {
    id: 'fg-indicator-tunnel',
    circuitId: CIRCUIT_TUNNEL_ID,
    position: new Vector3(15, -2.5, 0),
    color: new Color3(0.3, 0.7, 0.9),
    lightIntensity: 0.5,
  },
  {
    id: 'fg-indicator-staff-quarters',
    circuitId: CIRCUIT_STAFF_QUARTERS_ID,
    position: new Vector3(48, 3.6, -19),
    color: new Color3(0.8, 0.8, 0.6),
    lightIntensity: 0.5,
  },
  {
    id: 'fg-indicator-rooftop',
    circuitId: CIRCUIT_ROOFTOP_ANTENNA_ID,
    position: new Vector3(0, 8.5, 22),
    color: new Color3(0.9, 0.4, 0.9),
    lightIntensity: 0.6,
  },
  {
    id: 'fg-indicator-archive',
    circuitId: CIRCUIT_ARCHIVE_ID,
    position: new Vector3(6, 3.6, 21),
    color: new Color3(0.4, 0.9, 0.5),
    lightIntensity: 0.4,
  },
];

export function buildPoweredIndicators(
  ctx: FacilitySceneContext,
  scene: Scene,
): readonly PoweredStateBinding[] {
  const bindings: PoweredStateBinding[] = [];

  for (const spec of INDICATORS) {
    const lamp = CreateSphere(spec.id, { diameter: 0.3 }, scene);
    lamp.position.copyFrom(spec.position);
    lamp.isPickable = false;
    const mat = new StandardMaterial(`${spec.id}-mat`, scene);
    mat.diffuseColor = spec.color.scale(0.3);
    mat.emissiveColor = new Color3(0, 0, 0);
    lamp.material = mat;

    const light = new PointLight(`${spec.id}-light`, spec.position.clone(), scene);
    light.diffuse = spec.color;
    light.intensity = 0;
    light.range = 12;

    bindings.push(
      bindEmissiveToCircuit(ctx.powerNetwork, spec.circuitId, mat, spec.color),
      bindLightToCircuit(ctx.powerNetwork, spec.circuitId, light, spec.lightIntensity),
    );
  }

  return bindings;
}
