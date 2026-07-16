/**
 * Pure capacity arithmetic shared by PowerAllocation and PowerNetwork.
 * No mutation, no side effects.
 */

export function remainingCapacity(maxCapacity: number, allocatedCapacity: number): number {
  return Math.max(0, maxCapacity - allocatedCapacity);
}

export function canFitAdditionalCost(additionalCost: number, remaining: number): boolean {
  return additionalCost <= remaining;
}

export function clampNonNegative(value: number): number {
  return value < 0 ? 0 : value;
}
