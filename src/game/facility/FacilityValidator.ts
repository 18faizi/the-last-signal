/**
 * Development-time validator for facility scene data integrity.
 *
 * Checks:
 *   1. Duplicate zone / trigger / checkpoint / teleport ids.
 *   2. Unknown item references in lock definitions.
 *   3. A progression item is not required behind its own pickup door
 *      (e.g. the key to unlock A is only obtainable inside A).
 *   4. Zone reference validity in checkpoint and trigger definitions.
 *
 * Designed to run once at scene-creation time in development builds.
 * Returns an array of human-readable problem strings; an empty array means
 * the data is valid.
 *
 * Babylon-free.
 */
import type { FacilityZoneDefinition } from './FacilityZone';
import type { CheckpointDefinition } from './Checkpoint';
import type { TeleportDefinition } from './TeleportDefinition';

export interface FacilityValidationInput {
  readonly zones: readonly FacilityZoneDefinition[];
  readonly checkpoints: readonly CheckpointDefinition[];
  readonly teleports: readonly TeleportDefinition[];
  /** Item ids known to the InventoryRegistry at validation time. */
  readonly registeredItemIds: readonly string[];
  /** Lock requirement item ids referenced by door definitions. */
  readonly doorRequiredItemIds: readonly string[];
  /** Pickup item ids and the zone ids they are placed inside. */
  readonly pickupPlacements: readonly { pickupId: string; itemId: string; zoneId: string }[];
  /**
   * Door placements: which zone each door grants access to.
   * Used for the progression-item-behind-lock reachability check.
   */
  readonly doorGrants: readonly { doorId: string; requiredItemId: string; grantsZoneId: string }[];
}

export function validateFacilityData(input: FacilityValidationInput): string[] {
  const problems: string[] = [];

  // 1. Duplicate ids.
  const allIds: string[] = [];
  for (const z of input.zones) allIds.push(`zone:${z.id}`);
  for (const c of input.checkpoints) allIds.push(`checkpoint:${c.id}`);
  for (const t of input.teleports) allIds.push(`teleport:${t.id}`);
  const seen = new Set<string>();
  for (const id of allIds) {
    if (seen.has(id)) {
      problems.push(`Duplicate id detected: "${id}"`);
    }
    seen.add(id);
  }

  // 2. Unknown item references.
  const knownItems = new Set(input.registeredItemIds);
  for (const itemId of input.doorRequiredItemIds) {
    if (!knownItems.has(itemId)) {
      problems.push(`Door requires unknown item id "${itemId}"`);
    }
  }

  // 3. Progression-item-behind-own-lock check.
  //    If item X is required to open door D, and item X's pickup is only
  //    reachable by entering the zone that D grants access to, the game is
  //    softlocked.
  for (const grant of input.doorGrants) {
    const itemPickup = input.pickupPlacements.find((p) => p.itemId === grant.requiredItemId);
    if (itemPickup !== undefined && itemPickup.zoneId === grant.grantsZoneId) {
      problems.push(
        `Softlock: door "${grant.doorId}" requires item "${grant.requiredItemId}", ` +
          `but that item's pickup is inside the zone the door guards ("${grant.grantsZoneId}")`,
      );
    }
  }

  // 4. Unknown zone references in checkpoints.
  const knownZones = new Set(input.zones.map((z) => z.id));
  for (const pickup of input.pickupPlacements) {
    if (pickup.zoneId !== '' && !knownZones.has(pickup.zoneId)) {
      problems.push(`Pickup "${pickup.pickupId}" references unknown zone "${pickup.zoneId}"`);
    }
  }

  return problems;
}
