/**
 * Waveguide junction-box interaction: a compact, non-modal target near the
 * antenna deck (spec §24).
 *
 * DESIGN CHOICE (documented per the milestone spec's explicit request to
 * justify this): modeled as a single 'immediate'-kind InteractionTarget
 * (mirrors GeneratorInteractionTargets.ts's SimpleImmediateTarget precedent
 * — e.g. the fuel valve / breaker / selector, which are all one-press
 * state-cycling immediate targets) rather than a dedicated small modal or
 * the full AntennaPanel mode. Each [E] press cycles the junction to its
 * next candidate port, and the prompt label always shows the CURRENT
 * route — so "inspect junction, see current route, select correct receiver
 * path, confirm" all happen through repeated presses of the same existing
 * immediate-interaction affordance already used throughout the facility.
 * This avoids introducing a new panel/InteractionMode/InputLock entry for
 * what is fundamentally a single-axis, single-step routing puzzle, and
 * keeps the junction reachable/operable without first opening the full
 * antenna panel.
 */
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import {
  AVAILABLE,
  type InteractionAvailability,
  type InteractionContext,
  type InteractionPromptSpec,
  type InteractionResult,
  type InteractionTarget,
} from '../interaction/InteractionTarget';
import type { WaveguideController } from '../waveguide/WaveguideController';

export function createAntennaJunctionTarget(
  id: string,
  mesh: AbstractMesh,
  pathId: string,
  controller: WaveguideController,
): InteractionTarget {
  return {
    id,
    kind: 'immediate',
    meshes: [mesh],
    getPrompt: (): InteractionPromptSpec => {
      const currentPortId = controller.getCurrentPortId(pathId);
      const port = controller.listPortOptions(pathId).find((p) => p.id === currentPortId);
      return {
        verb: 'CYCLE ROUTE',
        label: `WAVEGUIDE JUNCTION (${port?.displayName.toUpperCase() ?? 'UNKNOWN'})`,
      };
    },
    getAvailability: (): InteractionAvailability => AVAILABLE,
    interact: (_context: InteractionContext): InteractionResult => {
      const ok = controller.cyclePort(pathId);
      return ok ? { status: 'completed' } : { status: 'failed', message: 'JUNCTION FAULT' };
    },
  };
}
