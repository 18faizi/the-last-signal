/**
 * Authored reactive event definition (Milestone 0.9).
 *
 * Stable ids, typed conditions, validated dependencies, optional delay and
 * ordered typed actions. Plain data — authored in
 * scenes/facility-greybox/threat/facilityEncounterDefinitions.ts.
 */
import type { EventAction } from './EventAction';
import type { EventCondition } from './EventCondition';

export interface EventDefinition {
  /** Stable authored id, e.g. 'fg-event-rooftop-aftermath'. */
  readonly id: string;
  readonly label: string;
  /** ALL conditions must hold for the event to arm. */
  readonly conditions: readonly EventCondition[];
  /** Event ids that must have fired first (validated: exist, acyclic). */
  readonly dependencies: readonly string[];
  /** True (default): fires exactly once. False: re-fires after re-arming. */
  readonly oneShot: boolean;
  /** Seconds between conditions holding and the actions running. */
  readonly delaySeconds: number;
  /** Ordered typed actions — executed strictly in this order. */
  readonly actions: readonly EventAction[];
}
