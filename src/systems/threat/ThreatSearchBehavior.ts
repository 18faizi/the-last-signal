/**
 * ThreatSearchBehavior: Dynamic Room Sweeping & Threshold Inspection (Milestone 1.4).
 *
 * Implements room-sweeping AI for the `ActiveSearch` state:
 *  - Zone threshold pauses: pauses at doorway / zone boundaries to scan the room.
 *  - Hiding spot scanning: calculates sight cone & bearing to hiding spots, sweeping facing yaw.
 *  - Sound stimulus inspection: steers search queue toward recent sound stimulus origins.
 *
 * Pure TypeScript — no direct DOM or Babylon dependencies.
 */
import type { Point3 } from '../../game/facility/FacilityZone';
import type { ThreatNavNode } from '../../game/threat/behavior/ThreatSearchPattern';

export interface HidingSpotTarget {
  readonly id: string;
  readonly displayName: string;
  readonly zoneId: string;
  readonly position: Point3;
  readonly fullyHiding: boolean;
  readonly concealment: number;
}

export interface SoundStimulusTarget {
  readonly position: Point3;
  readonly strength: number;
  readonly timestamp: number;
}

export interface RoomSweepConfig {
  readonly thresholdPauseDurationSeconds: number;
  readonly spotScanDurationSeconds: number;
  readonly sweepYawSpeedRadPerSec: number;
  readonly maxSweepDistance: number;
  readonly fovDeg: number;
}

export const DEFAULT_ROOM_SWEEP_CONFIG: RoomSweepConfig = {
  thresholdPauseDurationSeconds: 2.0,
  spotScanDurationSeconds: 1.5,
  sweepYawSpeedRadPerSec: 1.8,
  maxSweepDistance: 16.0,
  fovDeg: 120,
};

export type SweepPhase =
  'Idle' | 'ThresholdPause' | 'ScanningHidingSpots' | 'InspectingStimulus' | 'Complete';

/**
 * Normalizes an angle in radians to [-PI, PI].
 */
export function normalizeAngle(rad: number): number {
  let angle = rad % (2 * Math.PI);
  if (angle > Math.PI) angle -= 2 * Math.PI;
  if (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Shortest signed angular difference from angle `from` to `to` in radians.
 */
export function angleDifference(from: number, to: number): number {
  return normalizeAngle(to - from);
}

/**
 * Determines whether a target point falls within the observer's horizontal vision cone.
 */
export function isPointInVisionCone(
  observerPos: Point3,
  observerFacingYaw: number,
  targetPos: Point3,
  fovDeg: number,
  maxDistance: number,
): { inCone: boolean; distance: number; angleDiff: number } {
  const dx = targetPos.x - observerPos.x;
  const dz = targetPos.z - observerPos.z;
  const distance = Math.hypot(dx, dz);

  if (distance > maxDistance || distance < 1e-4) {
    return { inCone: false, distance, angleDiff: Math.PI };
  }

  const targetYaw = Math.atan2(dx, dz);
  const diff = angleDifference(observerFacingYaw, targetYaw);
  const halfFovRad = ((fovDeg / 2) * Math.PI) / 180;

  const inCone = Math.abs(diff) <= halfFovRad;
  return { inCone, distance, angleDiff: diff };
}

export class ThreatSearchBehavior {
  private phase: SweepPhase = 'Idle';
  private currentFacingYaw = 0;
  private targetFacingYaw = 0;
  private phaseTimer = 0;

  private hidingSpotsToScan: HidingSpotTarget[] = [];
  private currentSpotIndex = 0;
  private stimulusTarget: SoundStimulusTarget | null = null;
  private lastInspectedZoneId: string | null = null;

  constructor(private readonly config: RoomSweepConfig = DEFAULT_ROOM_SWEEP_CONFIG) {}

  get currentPhase(): SweepPhase {
    return this.phase;
  }

  get facingYaw(): number {
    return this.currentFacingYaw;
  }

  get isPausedAtThreshold(): boolean {
    return this.phase === 'ThresholdPause';
  }

  /**
   * Evaluates if moving between `fromNode` and `toNode` represents a zone threshold crossing.
   */
  isZoneThresholdCrossing(fromNode: ThreatNavNode, toNode: ThreatNavNode): boolean {
    return fromNode.zoneId !== toNode.zoneId;
  }

  /**
   * Starts a room sweep at a zone threshold.
   */
  beginThresholdSweep(
    position: Point3,
    initialFacingYaw: number,
    zoneId: string,
    allSpots: readonly HidingSpotTarget[],
    recentStimulus: SoundStimulusTarget | null = null,
  ): void {
    this.phase = 'ThresholdPause';
    this.phaseTimer = this.config.thresholdPauseDurationSeconds;
    this.currentFacingYaw = initialFacingYaw;
    this.lastInspectedZoneId = zoneId;
    this.stimulusTarget = recentStimulus;

    // Filter hiding spots in or near this zone within max sweep distance
    this.hidingSpotsToScan = allSpots.filter((spot) => {
      const dx = spot.position.x - position.x;
      const dz = spot.position.z - position.z;
      const d = Math.hypot(dx, dz);
      return spot.zoneId === zoneId || d <= this.config.maxSweepDistance;
    });

    this.currentSpotIndex = 0;
    this.calculateNextTargetYaw(position);
  }

  /**
   * Ticks the search behavior and updates current facing yaw and scan phases.
   */
  update(
    dt: number,
    currentPosition: Point3,
  ): { facingYaw: number; phase: SweepPhase; completed: boolean } {
    if (this.phase === 'Idle' || this.phase === 'Complete') {
      return {
        facingYaw: this.currentFacingYaw,
        phase: this.phase,
        completed: this.phase === 'Complete',
      };
    }

    this.phaseTimer -= dt;

    // Smoothly rotate toward target facing yaw
    const diff = angleDifference(this.currentFacingYaw, this.targetFacingYaw);
    const maxStep = this.config.sweepYawSpeedRadPerSec * dt;
    if (Math.abs(diff) <= maxStep) {
      this.currentFacingYaw = this.targetFacingYaw;
    } else {
      this.currentFacingYaw = normalizeAngle(this.currentFacingYaw + Math.sign(diff) * maxStep);
    }

    if (this.phase === 'ThresholdPause') {
      if (this.phaseTimer <= 0) {
        if (this.stimulusTarget !== null) {
          // Inspect stimulus first if present
          this.phase = 'InspectingStimulus';
          this.phaseTimer = this.config.spotScanDurationSeconds;
          const dx = this.stimulusTarget.position.x - currentPosition.x;
          const dz = this.stimulusTarget.position.z - currentPosition.z;
          this.targetFacingYaw = Math.atan2(dx, dz);
        } else if (this.hidingSpotsToScan.length > 0) {
          // Begin scanning hiding spots
          this.phase = 'ScanningHidingSpots';
          this.phaseTimer = this.config.spotScanDurationSeconds;
          this.calculateNextTargetYaw(currentPosition);
        } else {
          this.phase = 'Complete';
        }
      }
    } else if (this.phase === 'InspectingStimulus') {
      if (this.phaseTimer <= 0) {
        this.stimulusTarget = null;
        if (this.hidingSpotsToScan.length > 0) {
          this.phase = 'ScanningHidingSpots';
          this.phaseTimer = this.config.spotScanDurationSeconds;
          this.calculateNextTargetYaw(currentPosition);
        } else {
          this.phase = 'Complete';
        }
      }
    } else if (this.phase === 'ScanningHidingSpots') {
      if (this.phaseTimer <= 0) {
        this.currentSpotIndex++;
        if (this.currentSpotIndex < this.hidingSpotsToScan.length) {
          this.phaseTimer = this.config.spotScanDurationSeconds;
          this.calculateNextTargetYaw(currentPosition);
        } else {
          this.phase = 'Complete';
        }
      }
    }

    return {
      facingYaw: this.currentFacingYaw,
      phase: this.phase,
      completed: this.phase === 'Complete',
    };
  }

  /**
   * Sets target yaw toward the current hiding spot.
   */
  private calculateNextTargetYaw(currentPosition: Point3): void {
    const spot = this.hidingSpotsToScan[this.currentSpotIndex];
    if (spot !== undefined) {
      const dx = spot.position.x - currentPosition.x;
      const dz = spot.position.z - currentPosition.z;
      if (Math.hypot(dx, dz) > 1e-4) {
        this.targetFacingYaw = Math.atan2(dx, dz);
      }
    }
  }

  reset(): void {
    this.phase = 'Idle';
    this.phaseTimer = 0;
    this.hidingSpotsToScan = [];
    this.currentSpotIndex = 0;
    this.stimulusTarget = null;
    this.lastInspectedZoneId = null;
  }
}
