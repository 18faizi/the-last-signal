/**
 * Persistent Save/Load Schema for The Last Signal (Milestone 1.2).
 *
 * Fully serializable JSON DTO without any Babylon.js or DOM references.
 * Includes schema versioning, validation, and migration utilities.
 */

export const CURRENT_SAVE_SCHEMA_VERSION = 1;

export interface SaveMetadata {
  readonly slotId: string;
  readonly saveVersion: number;
  readonly timestamp: number;
  readonly playtimeSeconds: number;
  readonly chapterId: string;
}

export interface PlayerSaveState {
  readonly position: readonly [number, number, number];
  readonly yaw: number;
  readonly pitch: number;
  readonly crouched: boolean;
  readonly sprinting: boolean;
  readonly activeCheckpointId: string | null;
}

export interface FacilitySaveState {
  readonly progressionPhase: string;
  readonly discoveredZoneIds: readonly string[];
  readonly activeZoneId: string | null;
  readonly openedDoorIds: readonly string[];
  readonly unlockedDoorIds: readonly string[];
  readonly collectedPickupIds: readonly string[];
  readonly activatedCheckpointIds: readonly string[];
}

export interface InventorySaveState {
  readonly itemIds: readonly string[];
  readonly activeSlot: number | null;
  readonly inspectionHistory: readonly string[];
}

export interface PowerSaveState {
  readonly generatorState: string;
  readonly breakerStates: Readonly<Record<string, boolean>>;
  readonly activeCircuitIds: readonly string[];
  readonly powerPhase: string;
}

export interface SignalSaveState {
  readonly receiverState: string;
  readonly currentFrequencyMHz: number;
  readonly bandwidth: number;
  readonly lockConfidence: number;
  readonly decodedSignalIds: readonly string[];
  readonly signalPhase: string;
}

export interface AntennaSaveState {
  readonly azimuth: number;
  readonly elevation: number;
  readonly alignmentScore: number;
  readonly waveguideRoute: string;
  readonly telemetryReport: boolean;
  readonly selectedArray: string | null;
}

export interface ThreatSaveState {
  readonly threatPhase: string;
  readonly threatState: string;
  readonly suspicion: number;
  readonly detection: number;
  readonly completedEventIds: readonly string[];
  readonly encounterSurvivals: number;
}

export interface NarrativeSaveState {
  readonly revealedFacts: readonly string[];
  readonly readDocumentIds: readonly string[];
}

export interface InvestigationSaveState {
  readonly discoveredDocumentIds: readonly string[];
  readonly discoveredClueIds: readonly string[];
  readonly completedChainIds: readonly string[];
  readonly highlightedClueIds: readonly string[];
  readonly unlockedFrequencies: readonly number[];
  readonly unlockedDoorCodes: readonly string[];
}

export interface ObjectivesSaveState {
  readonly activeObjectiveId: string | null;
  readonly completedObjectiveIds: readonly string[];
  readonly activeStepIndex: number;
}

export interface HintsSaveState {
  readonly activeHintLevel: string;
  readonly struggleTimeSeconds: number;
}

export interface SaveSnapshot {
  readonly saveVersion: number;
  readonly metadata: SaveMetadata;
  readonly player: PlayerSaveState;
  readonly facility: FacilitySaveState;
  readonly inventory: InventorySaveState;
  readonly power: PowerSaveState;
  readonly signal: SignalSaveState;
  readonly antenna: AntennaSaveState;
  readonly threat: ThreatSaveState;
  readonly narrative: NarrativeSaveState;
  readonly investigation?: InvestigationSaveState;
  readonly objectives: ObjectivesSaveState;
  readonly hints: HintsSaveState;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validates whether an unknown object conforms to the SaveSnapshot schema.
 */
export function validateSaveSnapshot(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: ['Save data is not a valid JSON object'] };
  }

  const snap = raw as Partial<SaveSnapshot>;

  if (typeof snap.saveVersion !== 'number') {
    errors.push('Missing or invalid saveVersion');
  }

  if (!snap.metadata || typeof snap.metadata.slotId !== 'string') {
    errors.push('Missing or invalid metadata.slotId');
  }

  if (!snap.player || !Array.isArray(snap.player.position) || snap.player.position.length !== 3) {
    errors.push('Missing or invalid player.position');
  }

  if (!snap.facility || !Array.isArray(snap.facility.discoveredZoneIds)) {
    errors.push('Missing or invalid facility state');
  }

  if (!snap.inventory || !Array.isArray(snap.inventory.itemIds)) {
    errors.push('Missing or invalid inventory state');
  }

  if (!snap.power || typeof snap.power.generatorState !== 'string') {
    errors.push('Missing or invalid power state');
  }

  if (!snap.signal || !Array.isArray(snap.signal.decodedSignalIds)) {
    errors.push('Missing or invalid signal state');
  }

  if (!snap.antenna || typeof snap.antenna.alignmentScore !== 'number') {
    errors.push('Missing or invalid antenna state');
  }

  if (!snap.threat || typeof snap.threat.suspicion !== 'number') {
    errors.push('Missing or invalid threat state');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Migrates a raw save snapshot from earlier versions up to the current schema.
 */
export function migrateSaveSnapshot(raw: unknown): SaveSnapshot {
  const validation = validateSaveSnapshot(raw);
  if (!validation.valid) {
    throw new Error(`Cannot migrate invalid save data: ${validation.errors.join('; ')}`);
  }

  const snap = raw as SaveSnapshot;

  // Schema version 1 is currently latest. If version 2+ is introduced in later milestones,
  // migration branches can be added sequentially here.
  return snap;
}
