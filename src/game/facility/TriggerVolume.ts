/**
 * AABB trigger volume system.
 *
 * Trigger volumes fire callbacks when the player enters (and optionally exits)
 * a bounding box.  They differ from zones in that they are one-shot or
 * repeatable, and carry an arbitrary typed payload rather than a zone id.
 *
 * Performance contract: the polling loop in FacilityGreyboxScene calls
 * TriggerVolumeSet.update() only when the player has moved more than a
 * configurable threshold since the last check.
 *
 * Babylon-free; unit-testable with plain {x,y,z} positions.
 */
import { aabbContains, type ZoneAabb, type Point3 } from './FacilityZone';

export interface TriggerVolumeOptions {
  readonly id: string;
  readonly aabb: ZoneAabb;
  /**
   * When true the trigger fires every time the player enters.
   * When false (default) it fires exactly once.
   */
  readonly repeatable?: boolean;
  readonly onEnter: () => void;
  readonly onExit?: () => void;
}

interface TriggerVolumeState {
  readonly options: TriggerVolumeOptions;
  /** True when the player was inside on the previous update. */
  wasInside: boolean;
  /** True when a one-shot trigger has already fired. */
  fired: boolean;
}

export class TriggerVolumeSet {
  private readonly triggers = new Map<string, TriggerVolumeState>();

  add(options: TriggerVolumeOptions): void {
    if (this.triggers.has(options.id)) {
      throw new Error(`TriggerVolumeSet: duplicate trigger id "${options.id}"`);
    }
    this.triggers.set(options.id, { options, wasInside: false, fired: false });
  }

  get(id: string): TriggerVolumeOptions | undefined {
    return this.triggers.get(id)?.options;
  }

  getAll(): readonly TriggerVolumeOptions[] {
    return [...this.triggers.values()].map((s) => s.options);
  }

  hasFired(id: string): boolean {
    return this.triggers.get(id)?.fired ?? false;
  }

  /**
   * Update all triggers for the current player position.
   * Call from onBeforeRenderObservable (or after player moves).
   */
  update(playerPosition: Point3): void {
    for (const state of this.triggers.values()) {
      const inside = aabbContains(state.options.aabb, playerPosition);

      if (inside && !state.wasInside) {
        // Entered.
        const canFire = state.options.repeatable === true || !state.fired;
        if (canFire) {
          state.fired = true;
          try {
            state.options.onEnter();
          } catch {
            // Swallow.
          }
        }
        state.wasInside = true;
      } else if (!inside && state.wasInside) {
        // Exited.
        state.wasInside = false;
        if (state.options.onExit !== undefined) {
          try {
            state.options.onExit();
          } catch {
            // Swallow.
          }
        }
      }
    }
  }

  /**
   * Reset all trigger states (used when scene is reset).
   * Clears fired flags and inside state.
   */
  reset(): void {
    for (const state of this.triggers.values()) {
      state.wasInside = false;
      state.fired = false;
    }
  }

  clear(): void {
    this.triggers.clear();
  }

  get count(): number {
    return this.triggers.size;
  }
}
