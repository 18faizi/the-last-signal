import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';

export type InteractionTargetId = string;

/** How pressing the interaction key behaves for a target. */
export type TargetInteractionKind =
  'immediate' | 'hold' | 'inspect' | 'read' | 'panel' | 'disabled';

export interface InteractionPromptSpec {
  /** Action verb shown in the prompt, e.g. "USE", "INSPECT", "READ". */
  readonly verb: string;
  /** Target label, e.g. "SWITCH", "FIELD RADIO". */
  readonly label: string;
}

export type InteractionAvailabilityStatus = 'available' | 'disabled' | 'busy';

export interface InteractionAvailability {
  readonly status: InteractionAvailabilityStatus;
  /** Shown instead of the action prompt when disabled, e.g. "REQUIRES POWER". */
  readonly reason?: string;
}

export const AVAILABLE: InteractionAvailability = { status: 'available' };

export interface InteractionResult {
  readonly status: 'completed' | 'failed';
  readonly message?: string;
}

/** Data handed to targets on focus/interaction; no Babylon internals leak out. */
export interface InteractionContext {
  readonly playerPosition: Vector3;
  readonly distance: number;
}

/**
 * The reusable interaction contract. Future doors, switches, breakers,
 * terminals, documents, keys and puzzle controls implement this — the
 * framework never inspects mesh names or concrete classes.
 */
export interface InteractionTarget {
  readonly id: InteractionTargetId;
  readonly kind: TargetInteractionKind;
  /** Meshes belonging to this target; child meshes resolve to this target. */
  readonly meshes: readonly AbstractMesh[];
  /** Overrides the system default interaction distance when shorter. */
  readonly maxDistance?: number;
  /** Higher wins when two targets are hit at nearly the same distance. */
  readonly priority?: number;
  /** Hold targets: required hold duration in seconds. */
  readonly holdDurationSeconds?: number;
  /** Hold targets: whether completion can be repeated with a new press. */
  readonly repeatable?: boolean;

  getPrompt(context: InteractionContext): InteractionPromptSpec;
  getAvailability(context: InteractionContext): InteractionAvailability;
  interact(context: InteractionContext): InteractionResult | Promise<InteractionResult>;

  onFocusEnter?(context: InteractionContext): void;
  onFocusExit?(): void;
  dispose?(): void;
}

/** Targets that can be opened in the inspection view. */
export interface InspectableTarget extends InteractionTarget {
  readonly kind: 'inspect';
  readonly inspectionTitle: string;
  readonly inspectionDescription?: string;
  /**
   * Builds an isolated representation for the inspection rig. The world
   * meshes are never moved; implementations clone or rebuild primitives.
   */
  buildInspectionModel(scene: Scene): TransformNode;
}

export function isInspectableTarget(target: InteractionTarget): target is InspectableTarget {
  return target.kind === 'inspect';
}

/** Targets that open the document reader. */
export interface ReadableTarget extends InteractionTarget {
  readonly kind: 'read';
  readonly documentId: string;
}

export function isReadableTarget(target: InteractionTarget): target is ReadableTarget {
  return target.kind === 'read';
}

/** Targets that open the full-screen distribution panel overlay. */
export interface PanelTarget extends InteractionTarget {
  readonly kind: 'panel';
  readonly panelId: string;
}

export function isPanelTarget(target: InteractionTarget): target is PanelTarget {
  return target.kind === 'panel';
}
