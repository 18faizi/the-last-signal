/**
 * Interaction target for a hiding spot ("[E] HIDE" — Milestone 0.9).
 *
 * Thin wrapper over the authored HidingSpotDefinition implementing the
 * standard InteractionTarget contract; the InteractionSystem routes
 * 'hiding'-kind targets through the HidingSession, so interact() is only a
 * fallback used when no session is wired (never in the facility scene).
 */
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { HidingSpotDefinition } from '../../threat/stealth/HidingSpotDefinition';
import type { HidingSpotRegistry } from '../../threat/stealth/HidingSpotRegistry';
import type {
  HidingTarget,
  InteractionAvailability,
  InteractionPromptSpec,
  InteractionResult,
} from '../InteractionTarget';
import { AVAILABLE } from '../InteractionTarget';

export class HidingSpotTarget implements HidingTarget {
  readonly kind = 'hiding' as const;
  readonly id: string;
  readonly hidingSpotId: string;
  readonly meshes: readonly AbstractMesh[];
  readonly maxDistance: number;

  constructor(
    private readonly definition: HidingSpotDefinition,
    meshes: readonly AbstractMesh[],
    private readonly registry: HidingSpotRegistry,
    private readonly onDiscovered?: (spotId: string) => void,
    /** Director-gated availability ("enable hiding prompts" action). */
    private readonly isEnabled: () => boolean = () => true,
  ) {
    this.id = definition.id;
    this.hidingSpotId = definition.id;
    this.meshes = meshes;
    this.maxDistance = definition.interactionDistance;
  }

  getPrompt(): InteractionPromptSpec {
    return { verb: 'HIDE', label: this.definition.displayName };
  }

  getAvailability(): InteractionAvailability {
    if (!this.isEnabled()) {
      return { status: 'disabled', reason: 'NOTHING TO HIDE FROM' };
    }
    if (this.registry.occupiedSpotId !== null) {
      return { status: 'busy' };
    }
    return AVAILABLE;
  }

  interact(): InteractionResult {
    // Routed through HidingSession by the InteractionSystem; fallback no-op.
    return { status: 'completed' };
  }

  onFocusEnter(): void {
    this.onDiscovered?.(this.definition.id);
  }
}
