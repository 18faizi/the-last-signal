/**
 * Milestone 1.0 — Runtime Checkpoint Snapshot Types.
 *
 * Version 1 schema for complete serializable runtime snapshot state.
 * Contains ZERO Babylon.js or DOM objects.
 */

import type { PowerRuntimeSnapshot } from '../facility/FacilityRuntimeState';
import type { NarrativeRegistrySnapshot } from '../narrative/NarrativeFactRegistry';
import type { ObjectiveControllerSnapshot } from '../objectives/ObjectiveTypes';
import type { HintSnapshot } from '../hints/HintTypes';

export interface PlayerSnapshot {
  readonly position: readonly [number, number, number];
  readonly yaw: number;
}

export interface InventorySnapshot {
  readonly itemIds: readonly string[];
  readonly activeSlot: number | null;
  readonly inspectionHistory: readonly string[];
}

export interface FacilityStateSnapshot {
  readonly progressionPhase: string;
  readonly openedDoorIds: readonly string[];
  readonly collectedPickupIds: readonly string[];
  readonly discoveredZoneIds: readonly string[];
  readonly activatedCheckpointIds: readonly string[];
}

export interface SignalSnapshot {
  readonly receiverState: string;
  readonly currentFrequency: number;
  readonly bandwidth: number;
  readonly lockConfidence: number;
  readonly decodedTranscripts: readonly string[];
}

export interface AntennaSnapshot {
  readonly azimuth: number;
  readonly elevation: number;
  readonly alignmentScore: number;
  readonly waveguideRoute: string;
  readonly telemetryReport: boolean;
}

export interface ThreatSnapshot {
  readonly phase: string;
  readonly alertLevel: string;
  readonly detectionScore: number;
  readonly encounterSurvivals: number;
}

export interface RuntimeCheckpointSnapshot {
  readonly schemaVersion: 1;
  readonly checkpointId: string;
  readonly chapterId: string;
  readonly timestamp: number;
  readonly player: PlayerSnapshot;
  readonly inventory: InventorySnapshot;
  readonly facility: FacilityStateSnapshot;
  readonly power: PowerRuntimeSnapshot;
  readonly signal: SignalSnapshot;
  readonly antenna: AntennaSnapshot;
  readonly threat: ThreatSnapshot;
  readonly narrative: NarrativeRegistrySnapshot;
  readonly objectives: ObjectiveControllerSnapshot;
  readonly hints: HintSnapshot;
}
