/**
 * Typed runtime state for the facility greybox scene.
 *
 * Aggregates zone discovery, door states, pickup collection, checkpoint
 * activation and the current progression phase into a single observable
 * source of truth.  Written only on coarse state changes (zone entered,
 * phase changed, item collected); never written per-frame.
 *
 * Babylon-free.
 */
import type { ProgressionPhase } from './ProgressionPhase';
import { tryAdvancePhase } from './ProgressionPhase';

export type FacilityStateEventKind =
  | 'pickup-collected'
  | 'door-opened'
  | 'zone-discovered'
  | 'checkpoint-activated'
  | 'phase-changed'
  | 'completed'
  | 'reset'
  | 'power-state-changed';

export interface FacilityStateEvent {
  readonly kind: FacilityStateEventKind;
  readonly id?: string;
  readonly phase?: ProgressionPhase;
}

/**
 * Plain, serializable mirror of the power/generator domain state (Milestone
 * 0.6, spec §27). Populated live by FacilityGreyboxScene subscribing to
 * PowerNetwork/GeneratorController events — never mutated per-frame, and
 * never containing Babylon objects. This is a *read model*: the live
 * PowerNetwork/GeneratorController instances remain the source of truth and
 * are never recreated on checkpoint/OOB respawn, so this mirror is
 * preserved for free by simply not being touched by the respawn path.
 */
export interface PowerRuntimeSnapshot {
  readonly generatorState: string;
  readonly fuelValve: string;
  readonly starterBattery: string;
  readonly emergencyStop: string;
  readonly controlSelector: string;
  readonly mainBreaker: string;
  readonly circuits: Readonly<Record<string, { requested: string; effective: string }>>;
  readonly sourceAvailability: Readonly<Record<string, string>>;
  readonly receiverActivated: boolean;
  readonly powerNetworkOperational: boolean;
}

const EMPTY_POWER_SNAPSHOT: PowerRuntimeSnapshot = {
  generatorState: 'Offline',
  fuelValve: 'Closed',
  starterBattery: 'Disconnected',
  emergencyStop: 'Engaged',
  controlSelector: 'Off',
  mainBreaker: 'Open',
  circuits: {},
  sourceAvailability: {},
  receiverActivated: false,
  powerNetworkOperational: false,
};

export interface FacilityRuntimeSnapshot {
  readonly progressionPhase: ProgressionPhase;
  readonly isComplete: boolean;
  readonly collectedPickupIds: readonly string[];
  readonly openedDoorIds: readonly string[];
  readonly discoveredZoneIds: readonly string[];
  readonly activatedCheckpointIds: readonly string[];
  readonly power: PowerRuntimeSnapshot;
}

type FacilityStateListener = (event: FacilityStateEvent) => void;

export class FacilityRuntimeState {
  private phase: ProgressionPhase = 'Approach';
  private readonly collectedPickups = new Set<string>();
  private readonly openedDoors = new Set<string>();
  private readonly discoveredZones = new Set<string>();
  private readonly activatedCheckpoints = new Set<string>();
  private complete = false;
  private readonly listeners = new Set<FacilityStateListener>();

  // ----- Milestone 0.6: power runtime state mirror ------------------------
  private generatorState = EMPTY_POWER_SNAPSHOT.generatorState;
  private fuelValve = EMPTY_POWER_SNAPSHOT.fuelValve;
  private starterBattery = EMPTY_POWER_SNAPSHOT.starterBattery;
  private emergencyStop = EMPTY_POWER_SNAPSHOT.emergencyStop;
  private controlSelector = EMPTY_POWER_SNAPSHOT.controlSelector;
  private mainBreaker = EMPTY_POWER_SNAPSHOT.mainBreaker;
  private readonly circuits = new Map<string, { requested: string; effective: string }>();
  private readonly sourceAvailability = new Map<string, string>();
  private receiverActivated = false;
  private powerNetworkOperational = false;

  // ----- read ------------------------------------------------------------

  get progressionPhase(): ProgressionPhase {
    return this.phase;
  }

  get isComplete(): boolean {
    return this.complete;
  }

  hasPickup(id: string): boolean {
    return this.collectedPickups.has(id);
  }

  hasDoorOpened(id: string): boolean {
    return this.openedDoors.has(id);
  }

  hasZoneDiscovered(id: string): boolean {
    return this.discoveredZones.has(id);
  }

  hasCheckpointActivated(id: string): boolean {
    return this.activatedCheckpoints.has(id);
  }

  getSnapshot(): FacilityRuntimeSnapshot {
    return {
      progressionPhase: this.phase,
      isComplete: this.complete,
      collectedPickupIds: [...this.collectedPickups],
      openedDoorIds: [...this.openedDoors],
      discoveredZoneIds: [...this.discoveredZones],
      activatedCheckpointIds: [...this.activatedCheckpoints],
      power: this.getPowerSnapshot(),
    };
  }

  getPowerSnapshot(): PowerRuntimeSnapshot {
    return {
      generatorState: this.generatorState,
      fuelValve: this.fuelValve,
      starterBattery: this.starterBattery,
      emergencyStop: this.emergencyStop,
      controlSelector: this.controlSelector,
      mainBreaker: this.mainBreaker,
      circuits: Object.fromEntries(this.circuits),
      sourceAvailability: Object.fromEntries(this.sourceAvailability),
      receiverActivated: this.receiverActivated,
      powerNetworkOperational: this.powerNetworkOperational,
    };
  }

  // ----- write -----------------------------------------------------------

  recordPickupCollected(id: string): void {
    if (this.collectedPickups.has(id)) return;
    this.collectedPickups.add(id);
    this.emit({ kind: 'pickup-collected', id });
  }

  recordDoorOpened(id: string): void {
    if (this.openedDoors.has(id)) return;
    this.openedDoors.add(id);
    this.emit({ kind: 'door-opened', id });
  }

  recordZoneDiscovered(id: string): void {
    if (this.discoveredZones.has(id)) return;
    this.discoveredZones.add(id);
    this.emit({ kind: 'zone-discovered', id });
  }

  recordCheckpointActivated(id: string): void {
    if (this.activatedCheckpoints.has(id)) return;
    this.activatedCheckpoints.add(id);
    this.emit({ kind: 'checkpoint-activated', id });
  }

  /**
   * Attempt to advance the progression phase.  Returns true when the phase
   * actually changed.
   */
  tryAdvancePhase(target: ProgressionPhase): boolean {
    const next = tryAdvancePhase(this.phase, target);
    if (next === null) {
      return false;
    }
    this.phase = next;
    this.emit({ kind: 'phase-changed', phase: next });
    if (next === 'GreyboxComplete') {
      this.complete = true;
      this.emit({ kind: 'completed' });
    }
    return true;
  }

  // ----- Milestone 0.6: power runtime state recording ----------------------
  // These are called by FacilityGreyboxScene from PowerNetwork/
  // GeneratorController subscriptions — never from Babylon code directly,
  // and never per-frame (only on the underlying domain events).

  recordGeneratorState(state: string): void {
    if (this.generatorState === state) return;
    this.generatorState = state;
    this.emit({ kind: 'power-state-changed' });
  }

  recordFuelValve(value: string): void {
    this.fuelValve = value;
    this.emit({ kind: 'power-state-changed' });
  }

  recordStarterBattery(value: string): void {
    this.starterBattery = value;
    this.emit({ kind: 'power-state-changed' });
  }

  recordEmergencyStop(value: string): void {
    this.emergencyStop = value;
    this.emit({ kind: 'power-state-changed' });
  }

  recordControlSelector(value: string): void {
    this.controlSelector = value;
    this.emit({ kind: 'power-state-changed' });
  }

  recordMainBreaker(value: string): void {
    this.mainBreaker = value;
    this.emit({ kind: 'power-state-changed' });
  }

  recordCircuitState(circuitId: string, requested: string, effective: string): void {
    this.circuits.set(circuitId, { requested, effective });
    this.emit({ kind: 'power-state-changed', id: circuitId });
  }

  recordSourceAvailability(sourceId: string, availability: string): void {
    this.sourceAvailability.set(sourceId, availability);
    this.emit({ kind: 'power-state-changed', id: sourceId });
  }

  recordReceiverActivated(): void {
    if (this.receiverActivated) return;
    this.receiverActivated = true;
    this.emit({ kind: 'power-state-changed' });
  }

  recordPowerMilestoneComplete(): void {
    if (this.powerNetworkOperational) return;
    this.powerNetworkOperational = true;
    this.emit({ kind: 'power-state-changed' });
  }

  /** Reset all runtime state (preserves registered listeners). Dev "full reset" only. */
  reset(): void {
    this.phase = 'Approach';
    this.complete = false;
    this.collectedPickups.clear();
    this.openedDoors.clear();
    this.discoveredZones.clear();
    this.activatedCheckpoints.clear();
    this.generatorState = EMPTY_POWER_SNAPSHOT.generatorState;
    this.fuelValve = EMPTY_POWER_SNAPSHOT.fuelValve;
    this.starterBattery = EMPTY_POWER_SNAPSHOT.starterBattery;
    this.emergencyStop = EMPTY_POWER_SNAPSHOT.emergencyStop;
    this.controlSelector = EMPTY_POWER_SNAPSHOT.controlSelector;
    this.mainBreaker = EMPTY_POWER_SNAPSHOT.mainBreaker;
    this.circuits.clear();
    this.sourceAvailability.clear();
    this.receiverActivated = false;
    this.powerNetworkOperational = false;
    this.emit({ kind: 'reset' });
  }

  // ----- events ----------------------------------------------------------

  subscribe(listener: FacilityStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: FacilityStateEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow.
      }
    }
  }
}
