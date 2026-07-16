/**
 * Reusable Babylon-facing helpers built on PoweredStateBinding.
 *
 * Room builders call these instead of hand-rolling
 * `powerNetwork.isCircuitEnergized(...)` checks — the actual mesh/material/
 * light mutation lives in the callback here (Babylon-aware), while the
 * subscription bookkeeping lives in the Babylon-free PoweredStateBinding.
 */
import type { Light } from '@babylonjs/core/Lights/light';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PoweredStateBinding } from '../../../game/electrical/PoweredStateBinding';
import type { PowerNetwork } from '../../../game/power/PowerNetwork';
import type { PowerCircuitId } from '../../../game/power/PowerCircuitId';

/** Swaps a material's emissive color between an "on"/"off" pair as the circuit's power changes. */
export function bindEmissiveToCircuit(
  network: PowerNetwork,
  circuitId: PowerCircuitId,
  material: StandardMaterial,
  poweredEmissive: Color3,
  unpoweredEmissive: Color3 = new Color3(0, 0, 0),
): PoweredStateBinding {
  return PoweredStateBinding.forCircuit(network, circuitId, (powered) => {
    material.emissiveColor = powered ? poweredEmissive : unpoweredEmissive;
  });
}

/** Toggles a light's intensity between an "on"/"off" pair as the circuit's power changes. */
export function bindLightToCircuit(
  network: PowerNetwork,
  circuitId: PowerCircuitId,
  light: Light,
  poweredIntensity: number,
  unpoweredIntensity = 0,
): PoweredStateBinding {
  return PoweredStateBinding.forCircuit(network, circuitId, (powered) => {
    light.intensity = powered ? poweredIntensity : unpoweredIntensity;
  });
}
