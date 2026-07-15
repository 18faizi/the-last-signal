/**
 * Inspect-before-collect pickup interaction target.
 *
 * The player first opens the inspection view of the item (kind: 'inspect').
 * Inside the overlay, a "TAKE ITEM" button appears; pressing it collects the
 * item and returns to gameplay.
 *
 * The inspect flow delegates to InspectionController exactly like any other
 * InspectableTarget. InspectionOverlay detects `collectAfterInspect = true`
 * and surfaces the TAKE button alongside the standard close hints.
 */
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { InventoryService } from '../inventory/InventoryService';
import {
  AVAILABLE,
  type InspectableTarget,
  type InteractionAvailability,
  type InteractionContext,
  type InteractionPromptSpec,
  type InteractionResult,
} from '../interaction/InteractionTarget';
import type { PickupDefinition } from './PickupDefinition';

export class InspectablePickupTarget implements InspectableTarget {
  readonly kind = 'inspect' as const;
  readonly inspectionTitle: string;
  readonly inspectionDescription?: string;
  readonly meshes: readonly AbstractMesh[];

  /**
   * Signals to InspectionOverlay that a "TAKE ITEM" button should appear.
   * Checked by the overlay via duck typing: `'collectAfterInspect' in target`.
   */
  readonly collectAfterInspect = true;

  readonly id: string;

  private readonly def: PickupDefinition;
  private readonly inventory: InventoryService;
  private collected = false;

  /** Called by InspectionOverlay's TAKE button after building the session. */
  onCollect: (() => void) | null = null;

  constructor(def: PickupDefinition, meshes: readonly AbstractMesh[], inventory: InventoryService) {
    this.def = def;
    this.id = def.id;
    this.meshes = meshes;
    this.inventory = inventory;
    this.inspectionTitle = def.inspectionTitle ?? def.label;
    if (def.inspectionDescription !== undefined) {
      this.inspectionDescription = def.inspectionDescription;
    }
  }

  getPrompt(_context: InteractionContext): InteractionPromptSpec {
    return { verb: 'INSPECT', label: this.def.label };
  }

  getAvailability(_context: InteractionContext): InteractionAvailability {
    if (this.collected) {
      return { status: 'disabled', reason: 'COLLECTED' };
    }
    return AVAILABLE;
  }

  interact(_context: InteractionContext): InteractionResult {
    // The framework will open InspectionController because kind === 'inspect'.
    return { status: 'completed' };
  }

  buildInspectionModel(scene: Scene): TransformNode {
    const root = CreateBox(
      `pickup-inspect-${this.id}`,
      {
        width: 0.32,
        height: 0.14,
        depth: 0.1,
      },
      scene,
    );
    root.isPickable = false;
    const mat = new StandardMaterial(`pickup-inspect-mat-${this.id}`, scene);
    mat.diffuseColor = new Color3(0.7, 0.62, 0.4);
    mat.specularColor = new Color3(0.2, 0.2, 0.2);
    root.material = mat;
    return root;
  }

  /**
   * Called by the InspectionOverlay TAKE button or the PickupController
   * when the player confirms collection.
   */
  collect(): void {
    if (this.collected) {
      return;
    }
    this.collected = true;
    this.inventory.add(this.def.itemId, this.def.quantity ?? 1);
    for (const mesh of this.meshes) {
      mesh.isVisible = false;
      mesh.isPickable = false;
    }
    this.onCollect?.();
  }

  get isCollected(): boolean {
    return this.collected;
  }
}
