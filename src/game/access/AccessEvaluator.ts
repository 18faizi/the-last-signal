/**
 * Centralised lock evaluation with atomic consumption planning.
 *
 * evaluate() → plan → validate → apply consumption → change lock → emit events.
 * No partial states: if the plan cannot be applied in full, the lock state is
 * never changed.
 *
 * Babylon-free; depends only on InventoryService and typed domain objects.
 */
import type { InventoryService } from '../inventory/InventoryService';
import type { InventoryRegistry } from '../inventory/InventoryRegistry';
import type { InventoryItemId } from '../inventory/InventoryItemId';
import type { ConsumptionPolicy } from '../inventory/ItemConsumptionPolicy';
import type { AccessRequirement } from './AccessRequirement';
import type { LockDefinition } from './LockDefinition';
import type { LockState } from './LockState';
import type { AccessResult, ConsumptionStep } from './AccessResult';

export class AccessEvaluator {
  private readonly inventory: InventoryService;
  private readonly registry: InventoryRegistry;

  constructor(inventory: InventoryService, registry: InventoryRegistry) {
    this.inventory = inventory;
    this.registry = registry;
  }

  /**
   * Evaluate whether the player may open a lock right now.
   *
   * Returns AccessAllowed with a validated consumption plan, or AccessDenied
   * with user-facing feedback. Does NOT modify any state.
   */
  evaluate(lock: LockDefinition, lockState: LockState): AccessResult {
    if (lockState.value === 'unlocked' || lockState.value === 'disabled') {
      return { status: 'allowed', consumptionPlan: [] };
    }
    return this.check(lock.requirement, lock);
  }

  /**
   * Apply a previously-computed AccessAllowed result atomically.
   *
   * Validates that the inventory still satisfies the plan before touching
   * anything. If validation fails (e.g. item removed between evaluate and
   * apply), returns false and leaves the lock unchanged.
   */
  applyPlan(plan: readonly ConsumptionStep[], lockState: LockState): boolean {
    // Validate the full plan first.
    for (const step of plan) {
      if (this.inventory.getQuantity(step.itemId) < step.quantity) {
        return false;
      }
    }
    // Apply consumption.
    for (const step of plan) {
      if (step.policy === 'consume-one') {
        this.inventory.remove(step.itemId, step.quantity);
      } else if (step.policy === 'consume-all') {
        this.inventory.removeAll(step.itemId);
      }
      // 'retain' → no removal
    }
    // Advance lock state.
    lockState.value = 'unlocked';
    return true;
  }

  // ----- private ---------------------------------------------------------

  private check(req: AccessRequirement, lock: LockDefinition): AccessResult {
    switch (req.kind) {
      case 'none':
        return { status: 'allowed', consumptionPlan: [] };

      case 'item': {
        const needed = req.count ?? 1;
        const held = this.inventory.getQuantity(req.itemId);
        if (held < needed) {
          const def = this.registry.get(req.itemId);
          const name = def?.displayName ?? req.itemId;
          return {
            status: 'denied',
            missingItems: [req.itemId],
            userFacingReason: lock.lockedReason ?? `REQUIRES ${name.toUpperCase()}`,
          };
        }
        const policy = this.resolvePolicy(req);
        const step: ConsumptionStep = { itemId: req.itemId, quantity: needed, policy };
        return { status: 'allowed', consumptionPlan: [step] };
      }

      case 'any-of': {
        for (const child of req.children) {
          const result = this.check(child, lock);
          if (result.status === 'allowed') {
            return result;
          }
        }
        // Collect all missing items from every branch.
        const missing: InventoryItemId[] = [];
        for (const child of req.children) {
          const result = this.check(child, lock);
          if (result.status === 'denied') {
            for (const id of result.missingItems) {
              if (!missing.includes(id)) {
                missing.push(id);
              }
            }
          }
        }
        return {
          status: 'denied',
          missingItems: missing,
          userFacingReason: lock.lockedReason ?? 'ACCESS REQUIRED',
        };
      }

      case 'all-of': {
        const plan: ConsumptionStep[] = [];
        const missing: InventoryItemId[] = [];
        for (const child of req.children) {
          const result = this.check(child, lock);
          if (result.status === 'denied') {
            for (const id of result.missingItems) {
              if (!missing.includes(id)) {
                missing.push(id);
              }
            }
          } else {
            plan.push(...result.consumptionPlan);
          }
        }
        if (missing.length > 0) {
          return {
            status: 'denied',
            missingItems: missing,
            userFacingReason: lock.lockedReason ?? 'ACCESS REQUIRED',
          };
        }
        return { status: 'allowed', consumptionPlan: plan };
      }
    }
  }

  private resolvePolicy(req: {
    itemId: InventoryItemId;
    consumptionPolicy?: ConsumptionPolicy;
  }): ConsumptionPolicy {
    if (req.consumptionPolicy !== undefined) {
      return req.consumptionPolicy;
    }
    const def = this.registry.get(req.itemId);
    return def?.consumptionPolicy ?? 'retain';
  }
}
