/**
 * Composable lock requirements.
 *
 * Requirements are plain-data trees that the AccessEvaluator walks. They carry
 * no Babylon or DOM state. Compose them with the helper constructors below.
 *
 * NoRequirement   – always passes; useful for doors that unlock after a
 *                   scripted event rather than an item check.
 * ItemRequirement – the player must hold ≥ count of a specific item.
 * AnyOf           – at least one child requirement must pass.
 * AllOf           – every child requirement must pass.
 */
import type { InventoryItemId } from '../inventory/InventoryItemId';
import type { ConsumptionPolicy } from '../inventory/ItemConsumptionPolicy';

export type AccessRequirementKind = 'none' | 'item' | 'any-of' | 'all-of';

export interface NoRequirement {
  readonly kind: 'none';
}

export interface ItemRequirement {
  readonly kind: 'item';
  readonly itemId: InventoryItemId;
  /** Minimum quantity needed. Defaults to 1. */
  readonly count?: number;
  /**
   * Overrides the item definition's consumptionPolicy for this specific lock.
   * Falls back to the definition's policy when absent.
   */
  readonly consumptionPolicy?: ConsumptionPolicy;
}

export interface AnyOfRequirement {
  readonly kind: 'any-of';
  readonly children: readonly AccessRequirement[];
}

export interface AllOfRequirement {
  readonly kind: 'all-of';
  readonly children: readonly AccessRequirement[];
}

export type AccessRequirement =
  NoRequirement | ItemRequirement | AnyOfRequirement | AllOfRequirement;

// ----- helper constructors (no runtime overhead) -------------------------

export function noRequirement(): NoRequirement {
  return { kind: 'none' };
}

export function requireItem(
  itemId: InventoryItemId,
  options?: { count?: number; consumptionPolicy?: ConsumptionPolicy },
): ItemRequirement {
  return { kind: 'item', itemId, ...options };
}

export function anyOf(...children: AccessRequirement[]): AnyOfRequirement {
  return { kind: 'any-of', children };
}

export function allOf(...children: AccessRequirement[]): AllOfRequirement {
  return { kind: 'all-of', children };
}
