/**
 * Checkpoint system for the facility greybox scene.
 *
 * Checkpoints represent player-spawn positions activated by zone triggers.
 * Once activated, the latest-activated checkpoint becomes the respawn point
 * for the facility scene.  Inventory is never cleared on respawn.
 *
 * Babylon-free; unit-testable.
 */
import type { Point3 } from './FacilityZone';

export interface CheckpointDefinition {
  /** Unique id, e.g. 'fg-cp-gate'. */
  readonly id: string;
  /** Human-readable label for debug display. */
  readonly label: string;
  /**
   * World position the player is teleported to on respawn from this checkpoint.
   * Yaw is the player's facing angle in radians.
   */
  readonly spawnPosition: Point3;
  readonly spawnYaw: number;
}

interface CheckpointState {
  readonly definition: CheckpointDefinition;
  activated: boolean;
  activatedAt: number; // Date.now() value at activation
}

export class CheckpointRegistry {
  private readonly checkpoints = new Map<string, CheckpointState>();
  private latestId: string | null = null;
  private latestAt = 0;

  /** Register a checkpoint definition. Throws on duplicate id. */
  register(definition: CheckpointDefinition): void {
    if (this.checkpoints.has(definition.id)) {
      throw new Error(`CheckpointRegistry: duplicate checkpoint id "${definition.id}"`);
    }
    this.checkpoints.set(definition.id, { definition, activated: false, activatedAt: 0 });
  }

  get(id: string): CheckpointDefinition | undefined {
    return this.checkpoints.get(id)?.definition;
  }

  getAll(): readonly CheckpointDefinition[] {
    return [...this.checkpoints.values()].map((s) => s.definition);
  }

  isActivated(id: string): boolean {
    return this.checkpoints.get(id)?.activated ?? false;
  }

  private readonly listeners = new Set<(checkpointId: string) => void>();

  public subscribe(listener: (checkpointId: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Activate a checkpoint by id.  No-op if already activated. */
  activate(id: string, now = Date.now()): boolean {
    const state = this.checkpoints.get(id);
    if (state === undefined || state.activated) {
      return false;
    }
    state.activated = true;
    state.activatedAt = now;
    if (now >= this.latestAt) {
      this.latestId = id;
      this.latestAt = now;
    }
    for (const listener of this.listeners) {
      try {
        listener(id);
      } catch (err) {
        console.error('[CheckpointRegistry] Listener error:', err);
      }
    }
    return true;
  }

  /** The most recently activated checkpoint, or null if none activated. */
  get latestCheckpoint(): CheckpointDefinition | null {
    if (this.latestId === null) {
      return null;
    }
    return this.checkpoints.get(this.latestId)?.definition ?? null;
  }

  get activatedCount(): number {
    let count = 0;
    for (const state of this.checkpoints.values()) {
      if (state.activated) count++;
    }
    return count;
  }

  get totalCount(): number {
    return this.checkpoints.size;
  }

  reset(): void {
    for (const state of this.checkpoints.values()) {
      state.activated = false;
      state.activatedAt = 0;
    }
    this.latestId = null;
    this.latestAt = 0;
  }

  /** Restores activated checkpoints without firing progression side-effects. */
  restoreActivated(activatedIds: readonly string[], latestId?: string | null): void {
    this.reset();
    for (const id of activatedIds) {
      const state = this.checkpoints.get(id);
      if (state !== undefined) {
        state.activated = true;
        state.activatedAt = Date.now();
      }
    }
    if (latestId && this.checkpoints.has(latestId)) {
      this.latestId = latestId;
      this.latestAt = Date.now();
    } else if (activatedIds.length > 0) {
      const last = activatedIds[activatedIds.length - 1];
      if (last !== undefined && this.checkpoints.has(last)) {
        this.latestId = last;
        this.latestAt = Date.now();
      }
    }
  }

  clear(): void {
    this.reset();
    this.checkpoints.clear();
  }
}
