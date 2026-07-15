/**
 * Static, immutable description of a door's physical configuration.
 *
 * Registered at scene setup. The door controller reads these to build meshes
 * and set up animation parameters. No Babylon objects live here.
 */
import type { LockDefinition } from '../access/LockDefinition';

export type DoorMotionType = 'hinged' | 'sliding';

export interface HingedDoorConfig {
  readonly motionType: 'hinged';
  /** Width of the door leaf in metres. */
  readonly width: number;
  /** Height of the door leaf in metres. */
  readonly height: number;
  /** Thickness of the door leaf in metres. */
  readonly thickness?: number;
  /** Open angle in radians (default Math.PI / 2 = 90°). */
  readonly openAngle?: number;
  /**
   * Which side the hinge is on when viewed from the front.
   * 'left' (default) means the hinge is on −X and the door swings in +X→Z.
   */
  readonly hingeOnLeft?: boolean;
}

export interface SlidingDoorConfig {
  readonly motionType: 'sliding';
  readonly width: number;
  readonly height: number;
  readonly thickness?: number;
  /**
   * Axis along which the door slides when opening.
   * 'x' (default) or 'z'.
   */
  readonly slideAxis?: 'x' | 'z';
  /**
   * Distance the door slides when fully open, in metres.
   * Defaults to width (slides out of the way).
   */
  readonly slideDistance?: number;
}

export type DoorMotionConfig = HingedDoorConfig | SlidingDoorConfig;

export interface DoorDefinition {
  /** Unique id within the scene. */
  readonly id: string;
  /** Interaction label shown in the prompt, e.g. "MAINTENANCE DOOR". */
  readonly label: string;
  readonly motionConfig: DoorMotionConfig;
  /**
   * Lock to check when the player interacts. Omit for an always-unlocked door
   * (auto-opens on proximity or first interact).
   */
  readonly lock?: LockDefinition;
  /**
   * Seconds after fully opening before the door auto-closes.
   * Omit or 0 to disable auto-close.
   */
  readonly autoCloseSeconds?: number;
  /**
   * Animation speed multiplier (default 1). Values > 1 are faster.
   */
  readonly speedMultiplier?: number;
}
