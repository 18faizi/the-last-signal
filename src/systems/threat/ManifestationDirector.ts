/**
 * ManifestationDirector: Environmental & Atmospheric Presentation Engine (Milestone 1.4).
 *
 * Strictly separates the physical Threat Actor locomotion from environmental horrors:
 *  - Light Suppression: Cuts or blinks light fixtures dynamically based on Threat proximity.
 *  - Anomalous Spatial Audio: Emits low-frequency cable tunnel rumbles, metallic stress groans,
 *    and spatial distortion cues.
 *  - Door Glitches & Slams: Simulates electronic lock malfunctions and pneumatic slams.
 *
 * Pure TypeScript — coordinates with the scene via callbacks/interfaces.
 */
import type { Point3 } from '../../game/facility/FacilityZone';
import type { ThreatEscalationTier } from './ThreatBrain';

export type LightState = 'on' | 'off' | 'blink' | 'cut';

export interface LightFixtureProxy {
  readonly id: string;
  readonly position: Point3;
  mode: LightState;
}

export type ManifestationDirectorEvent =
  | { kind: 'LightSuppressed'; fixtureId: string; distance: number; previousMode: LightState }
  | { kind: 'LightRestored'; fixtureId: string; restoredMode: LightState }
  | { kind: 'SpatialSoundRequested'; soundId: string; position: Point3; volume: number }
  | { kind: 'DoorGlitchRequested'; doorId: string; effect: 'slam' | 'glitch-lock' };

export type ManifestationDirectorListener = (event: ManifestationDirectorEvent) => void;

export class ManifestationDirector {
  private currentTier: ThreatEscalationTier = 'Tier1_PostGenerator';
  private readonly listeners = new Set<ManifestationDirectorListener>();
  private readonly suppressedLights = new Map<string, LightState>();

  private ambientRumbleCooldown = 0;
  private doorGlitchCooldown = 0;

  constructor(initialTier: ThreatEscalationTier = 'Tier1_PostGenerator') {
    this.currentTier = initialTier;
  }

  get tier(): ThreatEscalationTier {
    return this.currentTier;
  }

  setTier(newTier: ThreatEscalationTier): void {
    this.currentTier = newTier;
  }

  subscribe(listener: ManifestationDirectorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Evaluates light fixtures against threat position and suppression radius.
   * Modifies light modes and notifies listeners.
   */
  updateLightSuppression(
    threatPosition: Point3,
    suppressionRadius: number,
    fixtures: readonly LightFixtureProxy[],
  ): void {
    if (suppressionRadius <= 0) {
      this.restoreAllLights(fixtures);
      return;
    }

    for (const fixture of fixtures) {
      const dx = fixture.position.x - threatPosition.x;
      const dy = fixture.position.y - threatPosition.y;
      const dz = fixture.position.z - threatPosition.z;
      const dist = Math.hypot(dx, dy, dz);

      if (dist <= suppressionRadius) {
        if (!this.suppressedLights.has(fixture.id)) {
          const prevMode = fixture.mode;
          this.suppressedLights.set(fixture.id, prevMode);
          // In close proximity, cut light; otherwise flicker/blink
          const newMode: LightState = dist < suppressionRadius * 0.5 ? 'cut' : 'blink';
          fixture.mode = newMode;
          this.emit({
            kind: 'LightSuppressed',
            fixtureId: fixture.id,
            distance: dist,
            previousMode: prevMode,
          });
        }
      } else if (this.suppressedLights.has(fixture.id)) {
        const originalMode = this.suppressedLights.get(fixture.id) ?? 'on';
        this.suppressedLights.delete(fixture.id);
        fixture.mode = originalMode;
        this.emit({
          kind: 'LightRestored',
          fixtureId: fixture.id,
          restoredMode: originalMode,
        });
      }
    }
  }

  /**
   * Restores any currently suppressed lights to their original state.
   */
  restoreAllLights(fixtures: readonly LightFixtureProxy[]): void {
    if (this.suppressedLights.size === 0) return;
    for (const fixture of fixtures) {
      const orig = this.suppressedLights.get(fixture.id);
      if (orig !== undefined) {
        fixture.mode = orig;
        this.emit({
          kind: 'LightRestored',
          fixtureId: fixture.id,
          restoredMode: orig,
        });
      }
    }
    this.suppressedLights.clear();
  }

  /**
   * Ticks atmospheric anomaly timers (distant sounds, door glitches).
   */
  update(dt: number, threatPosition: Point3 | null): void {
    this.ambientRumbleCooldown -= dt;
    this.doorGlitchCooldown -= dt;

    if (this.currentTier === 'Tier1_PostGenerator') {
      // Tier 1: Distant anomalies (cable tunnel rumbles, distant groans)
      if (this.ambientRumbleCooldown <= 0) {
        this.ambientRumbleCooldown = 18.0 + Math.random() * 12.0;
        this.emit({
          kind: 'SpatialSoundRequested',
          soundId: 'cable_tunnel_rumble',
          position: { x: 0, y: -2.0, z: 20 },
          volume: 0.6,
        });
      }
    } else if (this.currentTier === 'Tier2_PostAntenna') {
      // Tier 2: Door lock glitches near active patrol routes
      if (this.doorGlitchCooldown <= 0 && threatPosition !== null) {
        this.doorGlitchCooldown = 25.0 + Math.random() * 15.0;
        this.emit({
          kind: 'DoorGlitchRequested',
          doorId: 'fg-door-relay-room',
          effect: 'glitch-lock',
        });
      }
    } else if (this.currentTier === 'Tier3_Climax') {
      // Tier 3: Frequent spatial audio distortion and door slams
      if (this.ambientRumbleCooldown <= 0 && threatPosition !== null) {
        this.ambientRumbleCooldown = 10.0 + Math.random() * 8.0;
        this.emit({
          kind: 'SpatialSoundRequested',
          soundId: 'threat_distortion',
          position: { ...threatPosition },
          volume: 0.85,
        });
      }
    }
  }

  triggerDoorSlam(doorId: string): void {
    this.emit({
      kind: 'DoorGlitchRequested',
      doorId,
      effect: 'slam',
    });
  }

  triggerAnomalousSound(soundId: string, position: Point3, volume = 0.8): void {
    this.emit({
      kind: 'SpatialSoundRequested',
      soundId,
      position: { ...position },
      volume,
    });
  }

  reset(fixtures: readonly LightFixtureProxy[] = []): void {
    this.restoreAllLights(fixtures);
    this.ambientRumbleCooldown = 0;
    this.doorGlitchCooldown = 0;
  }

  dispose(fixtures: readonly LightFixtureProxy[] = []): void {
    this.restoreAllLights(fixtures);
    this.listeners.clear();
  }

  private emit(event: ManifestationDirectorEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Do not throw
      }
    }
  }
}
