/**
 * Manifestation scheduler (Milestone 0.9). Pure TS.
 *
 * One manifestation can be active at a time (they are authored presentation
 * beats, never simultaneous), which is exactly why ONE pooled silhouette
 * mesh assembly suffices scene-side. The controller owns timing/positions;
 * the scene binding subscribes and shows/hides/repositions the pooled
 * assembly, and reports obstruction (for endsWhenObstructed) via
 * notifyObstructed(). Ticked from the same scoped observer as the threat —
 * zero work while nothing is active.
 */
import type { Point3 } from '../../facility/FacilityZone';
import type { ManifestationDefinition } from './ManifestationDefinition';
import type { ManifestationState } from './ManifestationState';
import type { ManifestationId } from '../ThreatId';

export type ManifestationEventKind =
  'ManifestationStarted' | 'ManifestationEnded' | 'DisturbanceTriggered';

export interface ManifestationEvent {
  readonly kind: ManifestationEventKind;
  readonly manifestationId: ManifestationId;
  readonly definition: ManifestationDefinition;
}

export interface ManifestationSnapshot {
  readonly activeId: ManifestationId | null;
  readonly activePosition: Point3 | null;
  readonly activeFacingYaw: number;
  readonly completedIds: readonly ManifestationId[];
  readonly states: ReadonlyArray<{ id: ManifestationId; state: ManifestationState }>;
}

type ManifestationListener = (event: ManifestationEvent) => void;

export class ManifestationController {
  private readonly definitions = new Map<ManifestationId, ManifestationDefinition>();
  private readonly states = new Map<ManifestationId, ManifestationState>();
  private readonly listeners = new Set<ManifestationListener>();

  private active: ManifestationDefinition | null = null;
  private elapsed = 0;
  private readonly position = { x: 0, y: 0, z: 0 };
  private facingYaw = 0;

  register(definition: ManifestationDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`ManifestationController: duplicate id "${definition.id}"`);
    }
    this.definitions.set(definition.id, definition);
    this.states.set(definition.id, 'Idle');
  }

  get activeManifestation(): ManifestationDefinition | null {
    return this.active;
  }

  get hasActive(): boolean {
    return this.active !== null;
  }

  getState(id: ManifestationId): ManifestationState {
    return this.states.get(id) ?? 'Idle';
  }

  getSnapshot(): ManifestationSnapshot {
    return {
      activeId: this.active?.id ?? null,
      activePosition: this.active !== null ? { ...this.position } : null,
      activeFacingYaw: this.facingYaw,
      completedIds: [...this.states.entries()]
        .filter(([, s]) => s === 'Completed')
        .map(([id]) => id),
      states: [...this.states.entries()].map(([id, state]) => ({ id, state })),
    };
  }

  /**
   * Begins a manifestation. One-shot: a Completed manifestation never
   * replays (dev reset only). Returns false when unknown/busy/completed.
   */
  begin(id: ManifestationId): boolean {
    const def = this.definitions.get(id);
    if (def === undefined) return false;
    if (this.active !== null) return false;
    if (this.states.get(id) !== 'Idle') return false;
    this.states.set(id, 'Active');
    this.active = def;
    this.elapsed = 0;
    this.position.x = def.position.x;
    this.position.y = def.position.y;
    this.position.z = def.position.z;
    this.facingYaw = def.facingYaw;
    this.emit({ kind: 'ManifestationStarted', manifestationId: id, definition: def });
    if (def.type === 'mechanical-disturbance') {
      this.emit({ kind: 'DisturbanceTriggered', manifestationId: id, definition: def });
    }
    return true;
  }

  /** Scene binding reports the player's sightline to the active manifestation is obstructed. */
  notifyObstructed(): void {
    if (this.active !== null && this.active.endsWhenObstructed === true) {
      this.end();
    }
  }

  /** Tick: duration countdown + moving-presence translation (frame-rate independent). */
  update(deltaSecondsRaw: number): void {
    const def = this.active;
    if (def === null) return;
    const dt = Math.min(Math.max(deltaSecondsRaw, 0), 0.1);
    this.elapsed += dt;

    if (def.type === 'moving-presence' && def.moveTo !== undefined) {
      const speed = def.moveSpeed ?? 1.5;
      const dx = def.moveTo.x - this.position.x;
      const dy = def.moveTo.y - this.position.y;
      const dz = def.moveTo.z - this.position.z;
      const remaining = Math.hypot(dx, dy, dz);
      if (remaining > 1e-3) {
        const step = Math.min(speed * dt, remaining);
        const inv = 1 / remaining;
        this.position.x += dx * inv * step;
        this.position.y += dy * inv * step;
        this.position.z += dz * inv * step;
        this.facingYaw = Math.atan2(dx, dz);
      } else if (this.elapsed >= def.durationSeconds) {
        this.end();
        return;
      }
    }

    if (this.elapsed >= def.durationSeconds) {
      this.end();
    }
  }

  /** Ends the active manifestation immediately (also used by dev tooling). */
  end(): void {
    const def = this.active;
    if (def === null) return;
    this.active = null;
    this.states.set(def.id, 'Completed');
    this.emit({ kind: 'ManifestationEnded', manifestationId: def.id, definition: def });
  }

  subscribe(listener: ManifestationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Full reset (dev "full reset" action only): all Idle, nothing active. */
  reset(): void {
    if (this.active !== null) {
      this.end();
    }
    for (const id of this.states.keys()) {
      this.states.set(id, 'Idle');
    }
    this.elapsed = 0;
  }

  dispose(): void {
    this.active = null;
    this.listeners.clear();
  }

  private emit(event: ManifestationEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow.
      }
    }
  }
}
