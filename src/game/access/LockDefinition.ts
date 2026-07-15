/**
 * Static description of what a lock requires to open.
 *
 * Immutable; registered at scene setup alongside item definitions. The lock
 * id must be unique per scene. No Babylon objects, no runtime state.
 */
import type { AccessRequirement } from './AccessRequirement';

export interface LockDefinition {
  /** Unique identifier within the scene, e.g. 'door-maintenance-a'. */
  readonly id: string;
  readonly requirement: AccessRequirement;
  /**
   * Short phrase for the interaction prompt when locked, e.g.
   * "REQUIRES MAINTENANCE KEY". Falls back to a generic phrase when absent.
   */
  readonly lockedReason?: string;
}
