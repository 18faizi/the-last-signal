/**
 * Item, lock and door definitions for the AccessTestScene.
 *
 * All identifiers are prefixed 'at-' (access-test) to avoid collisions if
 * other scenes are ever loaded in the same session.
 *
 * Areas A–E:
 *   A: Direct-pickup key → unlocks door A (ItemRequirement, retain)
 *   B: Inspect-before-collect card → unlocks door B (ItemRequirement, retain)
 *   C: Hold-pickup tool → unlocks door C (ItemRequirement, consume-one)
 *   D: AnyOf door — either key-A or key-B unlocks it
 *   E: AllOf door — requires both key-A and key-B (retained)
 */
import type { InventoryItemDefinition } from '../../game/inventory/InventoryItemDefinition';
import type { LockDefinition } from '../../game/access/LockDefinition';
import { requireItem, anyOf, allOf } from '../../game/access/AccessRequirement';
import type { PickupDefinition } from '../../game/pickups/PickupDefinition';

// ----- Item definitions --------------------------------------------------

export const ITEM_DEFS: readonly InventoryItemDefinition[] = [
  {
    id: 'at-maintenance-key',
    displayName: 'Maintenance Key',
    description: 'Opens maintenance area doors.',
    category: 'key',
    consumptionPolicy: 'retain',
  },
  {
    id: 'at-security-card',
    displayName: 'Security Card',
    description: 'Access card for secure zones.',
    category: 'card',
    consumptionPolicy: 'retain',
  },
  {
    id: 'at-bypass-tool',
    displayName: 'Bypass Tool',
    description: 'Single-use electronic bypass.',
    category: 'tool',
    consumptionPolicy: 'consume-one',
    maxStack: 3,
  },
  {
    id: 'at-wrong-key',
    displayName: 'Wrong Key',
    description: 'Does not open any door in this area.',
    category: 'key',
    consumptionPolicy: 'retain',
  },
];

// ----- Pickup definitions ------------------------------------------------

export const PICKUP_DEFS: readonly PickupDefinition[] = [
  {
    id: 'at-pickup-maintenance-key',
    itemId: 'at-maintenance-key',
    label: 'MAINTENANCE KEY',
    mode: 'direct',
  },
  {
    id: 'at-pickup-security-card',
    itemId: 'at-security-card',
    label: 'SECURITY CARD',
    mode: 'inspect-before-collect',
    inspectionTitle: 'Security Card B',
    inspectionDescription: 'Personnel access card. Level 2 clearance.',
  },
  {
    id: 'at-pickup-bypass-tool',
    itemId: 'at-bypass-tool',
    label: 'BYPASS TOOL',
    mode: 'hold',
    holdDurationSeconds: 1.5,
  },
  {
    id: 'at-pickup-wrong-key',
    itemId: 'at-wrong-key',
    label: 'WRONG KEY',
    mode: 'direct',
  },
];

// ----- Lock definitions --------------------------------------------------

export const LOCK_A: LockDefinition = {
  id: 'at-lock-a',
  requirement: requireItem('at-maintenance-key'),
  lockedReason: 'REQUIRES MAINTENANCE KEY',
};

export const LOCK_B: LockDefinition = {
  id: 'at-lock-b',
  requirement: requireItem('at-security-card'),
  lockedReason: 'REQUIRES SECURITY CARD',
};

export const LOCK_C: LockDefinition = {
  id: 'at-lock-c',
  requirement: requireItem('at-bypass-tool', { consumptionPolicy: 'consume-one' }),
  lockedReason: 'REQUIRES BYPASS TOOL',
};

export const LOCK_D: LockDefinition = {
  id: 'at-lock-d',
  requirement: anyOf(requireItem('at-maintenance-key'), requireItem('at-security-card')),
  lockedReason: 'REQUIRES MAINTENANCE KEY OR SECURITY CARD',
};

export const LOCK_E: LockDefinition = {
  id: 'at-lock-e',
  requirement: allOf(requireItem('at-maintenance-key'), requireItem('at-security-card')),
  lockedReason: 'REQUIRES MAINTENANCE KEY AND SECURITY CARD',
};
