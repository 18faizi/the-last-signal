/**
 * Narrow player-movement -> sound-stimulus adapter (Milestone 0.9).
 *
 * The FirstPersonController is NOT rewritten for threat support — this
 * adapter is ticked by the scene bindings with the plain-data movement
 * snapshot the controller already exposes, and emits typed footstep/landing
 * stimuli into the SoundStimulusRegistry at an authored cadence. Sprinting
 * is louder and longer-ranged than walking; crouched movement emits nothing.
 * Pure TS, deterministic (cadence is simulation-time based, no wall clock).
 */
import type { Point3 } from '../../facility/FacilityZone';
import type { SoundStimulusRegistry } from './SoundStimulusRegistry';

export interface PlayerMovementSample {
  readonly position: Point3;
  readonly horizontalSpeed: number;
  readonly grounded: boolean;
  readonly sprinting: boolean;
  readonly crouched: boolean;
  readonly zoneId: string | null;
}

export const WALK_STEP_INTERVAL_SECONDS = 0.55;
export const SPRINT_STEP_INTERVAL_SECONDS = 0.35;
export const WALK_STEP_INTENSITY = 0.35;
export const SPRINT_STEP_INTENSITY = 0.7;
export const WALK_STEP_RADIUS = 8;
export const SPRINT_STEP_RADIUS = 16;
export const LANDING_INTENSITY = 0.6;
export const LANDING_RADIUS = 12;
export const STEP_DURATION_SECONDS = 0.8;
/** Below this speed the player counts as stationary (no footsteps). */
export const MOVEMENT_SPEED_FLOOR = 0.5;

export class PlayerStimulusAdapter {
  private stepAccumulator = 0;
  private wasAirborne = false;

  constructor(private readonly registry: SoundStimulusRegistry) {}

  update(deltaSeconds: number, sample: PlayerMovementSample): void {
    // Jump landing: airborne -> grounded edge.
    if (sample.grounded && this.wasAirborne) {
      this.registry.emit({
        position: sample.position,
        intensity: LANDING_INTENSITY,
        radius: LANDING_RADIUS,
        category: 'jump-landing',
        durationSeconds: STEP_DURATION_SECONDS,
        source: 'player',
        zoneId: sample.zoneId,
      });
    }
    this.wasAirborne = !sample.grounded;

    const moving = sample.grounded && sample.horizontalSpeed > MOVEMENT_SPEED_FLOOR;
    if (!moving || sample.crouched) {
      this.stepAccumulator = 0;
      return;
    }

    const interval = sample.sprinting ? SPRINT_STEP_INTERVAL_SECONDS : WALK_STEP_INTERVAL_SECONDS;
    this.stepAccumulator += Math.max(deltaSeconds, 0);
    if (this.stepAccumulator >= interval) {
      this.stepAccumulator -= interval;
      this.registry.emit({
        position: sample.position,
        intensity: sample.sprinting ? SPRINT_STEP_INTENSITY : WALK_STEP_INTENSITY,
        radius: sample.sprinting ? SPRINT_STEP_RADIUS : WALK_STEP_RADIUS,
        category: sample.sprinting ? 'footstep-sprint' : 'footstep-walk',
        durationSeconds: STEP_DURATION_SECONDS,
        source: 'player',
        zoneId: sample.zoneId,
      });
    }
  }

  reset(): void {
    this.stepAccumulator = 0;
    this.wasAirborne = false;
  }
}
