/**
 * Plain-data threat snapshot for the debug overlay, F1 view and test
 * bridge. No Babylon objects, no live references — safe to serialize.
 */
import type { Point3 } from '../facility/FacilityZone';
import type { ThreatBehaviorMode } from './behavior/ThreatBehaviorController';
import type { ThreatId, ThreatNodeId } from './ThreatId';
import type { ThreatState } from './ThreatState';

export interface ThreatControllerSnapshot {
  readonly id: ThreatId;
  readonly state: ThreatState;
  readonly active: boolean;
  readonly position: Point3;
  readonly facingYaw: number;
  readonly behaviorMode: ThreatBehaviorMode;
  readonly currentNodeId: ThreatNodeId | null;
  readonly suspicion: number;
  readonly detection: number;
  readonly fullDetectionFired: boolean;
  readonly lastKnownPlayerPosition: Point3 | null;
  readonly hasLineOfSight: boolean;
  readonly visionScore: number;
  readonly remainingSearchNodes: readonly ThreatNodeId[];
}
