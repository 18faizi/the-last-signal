/**
 * Output of AccessEvaluator.evaluate().
 *
 * The evaluator returns either an 'allowed' result (with a validated
 * consumption plan ready to apply) or a 'denied' result (with a user-facing
 * reason and the list of missing items for HUD feedback).
 */
import type { InventoryItemId } from '../inventory/InventoryItemId';
import type { ConsumptionPolicy } from '../inventory/ItemConsumptionPolicy';

/** One atomic removal that must be applied when unlocking. */
export interface ConsumptionStep {
  readonly itemId: InventoryItemId;
  readonly quantity: number;
  readonly policy: ConsumptionPolicy;
}

export interface AccessAllowed {
  readonly status: 'allowed';
  /** Ordered list of removals to apply atomically before changing lock state. */
  readonly consumptionPlan: readonly ConsumptionStep[];
}

export interface AccessDenied {
  readonly status: 'denied';
  /** Item IDs the player is missing (empty when the requirement is AnyOf and no branch passes). */
  readonly missingItems: readonly InventoryItemId[];
  /** Short phrase suitable for the interaction prompt, e.g. "REQUIRES MAINTENANCE KEY". */
  readonly userFacingReason: string;
}

export type AccessResult = AccessAllowed | AccessDenied;
