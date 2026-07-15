/**
 * Direct and hold pickup interaction target.
 *
 * 'direct' mode: single press collects immediately.
 * 'hold'   mode: hold E for holdDurationSeconds to collect.
 *
 * Both modes hide the mesh and disable the target after collection so the
 * interaction framework stops raycasting it. They do NOT create or manage
 * Babylon physics or materials — the mesh is purely visual.
 */
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { InventoryService } from '../inventory/InventoryService';
import {
  AVAILABLE,
  type InteractionAvailability,
  type InteractionContext,
  type InteractionPromptSpec,
  type InteractionResult,
  type InteractionTarget,
  type TargetInteractionKind,
} from '../interaction/InteractionTarget';
import type { PickupDefinition } from './PickupDefinition';

export class PickupInteractionTarget implements InteractionTarget {
  readonly id: string;
  readonly kind: TargetInteractionKind;
  readonly meshes: readonly AbstractMesh[];
  readonly holdDurationSeconds: number;
  readonly repeatable = false;

  private readonly def: PickupDefinition;
  private readonly inventory: InventoryService;
  private collected = false;

  constructor(def: PickupDefinition, meshes: readonly AbstractMesh[], inventory: InventoryService) {
    this.def = def;
    this.id = def.id;
    this.meshes = meshes;
    this.inventory = inventory;
    this.holdDurationSeconds = def.holdDurationSeconds ?? 1.5;

    const mode = def.mode ?? 'direct';
    this.kind = mode === 'hold' ? 'hold' : 'immediate';
  }

  getPrompt(_context: InteractionContext): InteractionPromptSpec {
    return { verb: this.kind === 'hold' ? 'TAKE' : 'PICK UP', label: this.def.label };
  }

  getAvailability(_context: InteractionContext): InteractionAvailability {
    if (this.collected) {
      return { status: 'disabled', reason: 'COLLECTED' };
    }
    return AVAILABLE;
  }

  interact(_context: InteractionContext): InteractionResult {
    if (this.collected) {
      return { status: 'failed', message: 'Already collected' };
    }
    this.collect();
    return { status: 'completed' };
  }

  get isCollected(): boolean {
    return this.collected;
  }

  private collect(): void {
    this.collected = true;
    this.inventory.add(this.def.itemId, this.def.quantity ?? 1);
    for (const mesh of this.meshes) {
      mesh.isVisible = false;
      mesh.isPickable = false;
    }
  }
}
