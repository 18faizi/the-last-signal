/**
 * Authored threat definition (Milestone 0.9).
 *
 * Plain data: everything the threat controller, perception model and
 * behavior model need is authored here — no tunables buried in code paths.
 * Validated by ThreatValidation at scene creation (dev builds).
 */
import type { ThreatId, ThreatNodeId, SafeZoneId } from './ThreatId';

export interface ThreatVisionConfig {
  /** Hard visual range in metres — beyond this the vision score is 0. */
  readonly maxViewDistance: number;
  /** Full horizontal field of view in degrees (centred on facing). */
  readonly horizontalFovDeg: number;
  /** Vertical tolerance in metres (|dy| beyond this zeroes the score). */
  readonly verticalToleranceMeters: number;
  /** Distance at which falloff begins (metres); score is 1 inside it. */
  readonly falloffStartDistance: number;
  /** Multiplier applied while the player sprints (largest). */
  readonly sprintMultiplier: number;
  /** Multiplier applied while the player walks. */
  readonly walkMultiplier: number;
  /** Multiplier applied while the player crouches (smallest). */
  readonly crouchMultiplier: number;
  /** Multiplier for targets inside the outer third of the FOV cone. */
  readonly peripheralPenalty: number;
  /** Multiplier for targets fully behind the threat (outside the FOV). */
  readonly behindMultiplier: number;
}

export interface ThreatSuspicionConfig {
  /** Suspicion gained per second at vision score 1. */
  readonly suspicionGainPerSecond: number;
  /** Suspicion decay per second with no stimulus. */
  readonly suspicionDecayPerSecond: number;
  /** Suspicion level that escalates Unaware -> Suspicious. */
  readonly suspiciousThreshold: number;
  /** Suspicion level that escalates Suspicious -> Investigating. */
  readonly investigateThreshold: number;
  /** Suspicion level below which Suspicious relaxes back to Unaware. */
  readonly relaxThreshold: number;
  /** Detection gained per second at vision score 1 (two-stage model). */
  readonly detectionGainPerSecond: number;
  /** Detection decay per second while line of sight holds. */
  readonly detectionDecayPerSecond: number;
  /** Slower detection decay per second after line of sight breaks. */
  readonly detectionDecayAfterLosBreakPerSecond: number;
  /** Minimum vision score before detection (stage two) accumulates at all. */
  readonly detectionVisionFloor: number;
}

export interface ThreatMovementConfig {
  /** Patrol / investigation movement speed (m/s). */
  readonly moveSpeed: number;
  /** Pursuit movement speed (m/s) — authored below player sprint speed. */
  readonly pursuitSpeed: number;
  /** Pause at an investigation point before resolving (seconds). */
  readonly investigationPauseSeconds: number;
  /** Pause at each search node (seconds). */
  readonly searchNodePauseSeconds: number;
  /** Total search budget before withdrawing (seconds). */
  readonly searchTimeoutSeconds: number;
  /** LOS-broken time before a pursuit degrades to LostTarget (seconds). */
  readonly pursuitLosLossSeconds: number;
  /** Capture boundary radius around the threat (metres). */
  readonly captureRadius: number;
}

export interface ThreatDefinition {
  readonly id: ThreatId;
  readonly displayName: string;
  readonly vision: ThreatVisionConfig;
  readonly suspicion: ThreatSuspicionConfig;
  readonly movement: ThreatMovementConfig;
  /** Node the threat spawns at / withdraws to. */
  readonly homeNodeId: ThreatNodeId;
  /** Zones the threat is allowed to occupy — it never leaves them. */
  readonly allowedZoneIds: readonly string[];
  /** Safe zones the threat refuses to enter. */
  readonly safeZoneIds: readonly SafeZoneId[];
}
