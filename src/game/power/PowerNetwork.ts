/**
 * Orchestrating power domain service.
 *
 * Registers sources, circuits and loads; processes circuit state requests
 * atomically (validate the full plan before mutating anything); computes
 * effective circuit/load powered state; emits typed events with disposable
 * subscriptions.
 *
 * No Babylon, no DOM, no per-frame writes — this is domain state, observed
 * by rendering/UI through events, exactly like InventoryService.
 */
import type { PowerSourceDefinition } from './PowerSource';
import { createPowerSourceState, type PowerSourceState } from './PowerSourceState';
import type { PowerSourceId } from './PowerSourceId';
import type { PowerCircuitDefinition } from './PowerCircuit';
import {
  createPowerCircuitState,
  type CircuitRequestedState,
  type PowerCircuitState,
} from './PowerCircuitState';
import type { PowerCircuitId } from './PowerCircuitId';
import type { PowerLoadDefinition } from './PowerLoad';
import { createPowerLoadState, type PowerLoadState } from './PowerLoadState';
import type { PowerLoadId } from './PowerLoadId';
import { validateAllocation } from './PowerAllocation';
import type { PowerEvent } from './PowerEvent';
import type {
  PowerCircuitSnapshot,
  PowerLoadSnapshot,
  PowerSnapshot,
  PowerSourceSnapshot,
} from './PowerSnapshot';
import { PowerError } from './PowerError';

export interface RequestCircuitResult {
  readonly ok: boolean;
  readonly reason?: string;
}

type PowerListener = (event: PowerEvent) => void;

export class PowerNetwork {
  private readonly sourceDefs = new Map<PowerSourceId, PowerSourceDefinition>();
  private readonly sourceStates = new Map<PowerSourceId, PowerSourceState>();
  private readonly circuitDefs = new Map<PowerCircuitId, PowerCircuitDefinition>();
  private readonly circuitStates = new Map<PowerCircuitId, PowerCircuitState>();
  private readonly loadDefs = new Map<PowerLoadId, PowerLoadDefinition>();
  private readonly loadStates = new Map<PowerLoadId, PowerLoadState>();
  private readonly loadsByCircuit = new Map<PowerCircuitId, PowerLoadId[]>();
  private readonly listeners = new Set<PowerListener>();

  // ----- registration ------------------------------------------------------

  registerSource(def: PowerSourceDefinition): void {
    if (this.sourceDefs.has(def.id)) {
      throw new PowerError('duplicate-id', `PowerNetwork: duplicate source id "${def.id}"`);
    }
    this.sourceDefs.set(def.id, def);
    this.sourceStates.set(def.id, createPowerSourceState(def.id));
  }

  registerCircuit(def: PowerCircuitDefinition): void {
    if (this.circuitDefs.has(def.id)) {
      throw new PowerError('duplicate-id', `PowerNetwork: duplicate circuit id "${def.id}"`);
    }
    this.circuitDefs.set(def.id, def);
    this.circuitStates.set(def.id, createPowerCircuitState(def.id));
    this.loadsByCircuit.set(def.id, []);
  }

  registerLoad(def: PowerLoadDefinition): void {
    if (this.loadDefs.has(def.id)) {
      throw new PowerError('duplicate-id', `PowerNetwork: duplicate load id "${def.id}"`);
    }
    if (!this.circuitDefs.has(def.circuitId)) {
      throw new PowerError(
        'unknown-circuit',
        `PowerNetwork: load "${def.id}" references unknown circuit "${def.circuitId}"`,
      );
    }
    this.loadDefs.set(def.id, def);
    this.loadStates.set(def.id, createPowerLoadState(def.id));
    this.loadsByCircuit.get(def.circuitId)?.push(def.id);
  }

  // ----- read ----------------------------------------------------------------

  isCircuitEnergized(circuitId: PowerCircuitId): boolean {
    return this.circuitStates.get(circuitId)?.effective === 'energized';
  }

  isLoadPowered(loadId: PowerLoadId): boolean {
    return this.loadStates.get(loadId)?.powered ?? false;
  }

  getSourceState(sourceId: PowerSourceId): Readonly<PowerSourceState> | undefined {
    return this.sourceStates.get(sourceId);
  }

  getCircuitState(circuitId: PowerCircuitId): Readonly<PowerCircuitState> | undefined {
    return this.circuitStates.get(circuitId);
  }

  getCircuitDefinition(circuitId: PowerCircuitId): PowerCircuitDefinition | undefined {
    return this.circuitDefs.get(circuitId);
  }

  getSourceDefinition(sourceId: PowerSourceId): PowerSourceDefinition | undefined {
    return this.sourceDefs.get(sourceId);
  }

  getAllCircuits(): readonly PowerCircuitDefinition[] {
    return [...this.circuitDefs.values()];
  }

  getAllSources(): readonly PowerSourceDefinition[] {
    return [...this.sourceDefs.values()];
  }

  getSnapshot(): PowerSnapshot {
    const sources: PowerSourceSnapshot[] = [];
    for (const def of this.sourceDefs.values()) {
      const state = this.sourceStates.get(def.id);
      if (state === undefined) continue;
      sources.push({
        id: def.id,
        kind: def.kind,
        displayName: def.displayName,
        availability: state.availability,
        maxCapacity: def.maxCapacity,
        allocatedCapacity: state.allocatedCapacity,
      });
    }
    const circuits: PowerCircuitSnapshot[] = [];
    for (const def of this.circuitDefs.values()) {
      const state = this.circuitStates.get(def.id);
      if (state === undefined) continue;
      circuits.push({
        id: def.id,
        displayName: def.displayName,
        description: def.description,
        capacityCost: def.capacityCost,
        requested: state.requested,
        effective: state.effective,
        sourceId: state.sourceId,
        emergencyEligible: def.emergencyEligible,
        eligibleSourceIds: def.eligibleSourceIds,
      });
    }
    const loads: PowerLoadSnapshot[] = [];
    for (const def of this.loadDefs.values()) {
      const state = this.loadStates.get(def.id);
      if (state === undefined) continue;
      loads.push({ id: def.id, circuitId: def.circuitId, powered: state.powered });
    }
    return { sources, circuits, loads };
  }

  // ----- write -----------------------------------------------------------

  /**
   * Change a source's availability (e.g. generator comes online/offline).
   * When a source goes offline, every circuit currently energized from it is
   * atomically de-energized (cascading load-unpowered events) — a source
   * never silently keeps "phantom" allocated capacity.
   */
  setSourceAvailability(sourceId: PowerSourceId, availability: 'offline' | 'available'): void {
    const state = this.sourceStates.get(sourceId);
    const def = this.sourceDefs.get(sourceId);
    if (state === undefined || def === undefined) {
      throw new PowerError('unknown-source', `PowerNetwork: unknown source "${sourceId}"`);
    }
    if (state.availability === availability) {
      return;
    }
    state.availability = availability;
    this.emit({ kind: 'source-state-changed', sourceId, availability });

    if (availability === 'offline') {
      for (const [circuitId, circuitState] of this.circuitStates) {
        if (circuitState.effective === 'energized' && circuitState.sourceId === sourceId) {
          this.deEnergizeCircuit(circuitId, 'SOURCE WENT OFFLINE');
        }
      }
    }
  }

  /**
   * Request a circuit be turned on (energized from `sourceId`) or off.
   * Atomic: the plan is fully validated before any state changes. Returns
   * ok:false with a reason on rejection; the circuit is left untouched.
   */
  requestCircuit(
    circuitId: PowerCircuitId,
    sourceId: PowerSourceId,
    desired: CircuitRequestedState,
  ): RequestCircuitResult {
    const circuit = this.circuitDefs.get(circuitId);
    const circuitState = this.circuitStates.get(circuitId);
    if (circuit === undefined || circuitState === undefined) {
      throw new PowerError('unknown-circuit', `PowerNetwork: unknown circuit "${circuitId}"`);
    }
    const source = this.sourceDefs.get(sourceId);
    const sourceState = this.sourceStates.get(sourceId);
    if (source === undefined || sourceState === undefined) {
      throw new PowerError('unknown-source', `PowerNetwork: unknown source "${sourceId}"`);
    }

    this.emit({ kind: 'circuit-requested', circuitId, sourceId });

    const result = validateAllocation(
      {
        source,
        sourceState,
        circuit,
        currentEffective: circuitState.effective,
        currentSourceId: circuitState.sourceId,
      },
      desired,
    );

    if (!result.ok) {
      this.emit({ kind: 'allocation-rejected', circuitId, sourceId, reason: result.reason });
      return { ok: false, reason: result.reason };
    }

    const plan = result.plan;

    // Apply atomically: free old allocation, apply new allocation, update
    // circuit/source state, recompute load powered flags, emit events.
    if (plan.freedFromSourceId !== null && plan.freedCapacity > 0) {
      const freedSourceState = this.sourceStates.get(plan.freedFromSourceId);
      if (freedSourceState !== undefined) {
        freedSourceState.allocatedCapacity = Math.max(
          0,
          freedSourceState.allocatedCapacity - plan.freedCapacity,
        );
        this.emit({ kind: 'capacity-changed', sourceId: plan.freedFromSourceId });
      }
    }
    if (plan.sourceId !== null && plan.capacityDelta > 0) {
      sourceState.allocatedCapacity += plan.capacityDelta;
      this.emit({ kind: 'capacity-changed', sourceId: plan.sourceId });
    }

    const wasEnergized = circuitState.effective === 'energized';
    circuitState.requested = plan.newRequested;
    circuitState.effective = plan.newEffective;
    circuitState.sourceId = plan.sourceId;

    if (plan.newEffective === 'energized' && !wasEnergized) {
      this.emit(
        plan.sourceId !== null
          ? { kind: 'circuit-energized', circuitId, sourceId: plan.sourceId }
          : { kind: 'circuit-energized', circuitId },
      );
      this.setLoadsPowered(circuitId, true);
    } else if (plan.newEffective === 'de-energized' && wasEnergized) {
      this.emit({ kind: 'circuit-de-energized', circuitId });
      this.setLoadsPowered(circuitId, false);
    }

    return { ok: true };
  }

  /** Convenience: de-energize a circuit regardless of current source. */
  deEnergizeCircuit(circuitId: PowerCircuitId, reason?: string): void {
    const circuitState = this.circuitStates.get(circuitId);
    if (circuitState === undefined || circuitState.effective === 'de-energized') {
      return;
    }
    const sourceId = circuitState.sourceId;
    if (sourceId !== null) {
      const sourceState = this.sourceStates.get(sourceId);
      const circuit = this.circuitDefs.get(circuitId);
      if (sourceState !== undefined && circuit !== undefined) {
        sourceState.allocatedCapacity = Math.max(
          0,
          sourceState.allocatedCapacity - circuit.capacityCost,
        );
        this.emit({ kind: 'capacity-changed', sourceId });
      }
    }
    circuitState.requested = 'off';
    circuitState.effective = 'de-energized';
    circuitState.sourceId = null;
    this.emit(
      reason !== undefined
        ? { kind: 'circuit-de-energized', circuitId, reason }
        : { kind: 'circuit-de-energized', circuitId },
    );
    this.setLoadsPowered(circuitId, false);
  }

  /**
   * Best-effort re-home of every circuit currently energized from
   * `fromSourceId` onto `toSourceId`, when eligible and capacity allows.
   * Used by EmergencyPowerController to transfer circuits from the battery
   * onto the generator once it comes online. Circuits that don't fit stay on
   * their current source — never left de-energized by a transfer attempt.
   */
  transferCircuits(
    fromSourceId: PowerSourceId,
    toSourceId: PowerSourceId,
  ): readonly PowerCircuitId[] {
    const transferred: PowerCircuitId[] = [];
    for (const [circuitId, state] of this.circuitStates) {
      if (state.effective !== 'energized' || state.sourceId !== fromSourceId) continue;
      const circuit = this.circuitDefs.get(circuitId);
      if (circuit === undefined || !circuit.eligibleSourceIds.includes(toSourceId)) continue;
      const result = this.requestCircuit(circuitId, toSourceId, 'on');
      if (result.ok) {
        transferred.push(circuitId);
        this.emit({ kind: 'emergency-transfer', circuitId, sourceId: toSourceId });
      }
    }
    return transferred;
  }

  /** Subscribe to power events. Returns a disposable unsubscribe function. */
  subscribe(listener: PowerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Resets all runtime state to power-off defaults (sources offline, circuits off). */
  reset(): void {
    for (const state of this.sourceStates.values()) {
      state.availability = 'offline';
      state.allocatedCapacity = 0;
    }
    for (const [circuitId, state] of this.circuitStates) {
      const wasEnergized = state.effective === 'energized';
      state.requested = 'off';
      state.effective = 'de-energized';
      state.sourceId = null;
      if (wasEnergized) {
        this.setLoadsPowered(circuitId, false);
      }
    }
  }

  dispose(): void {
    this.listeners.clear();
    this.sourceDefs.clear();
    this.sourceStates.clear();
    this.circuitDefs.clear();
    this.circuitStates.clear();
    this.loadDefs.clear();
    this.loadStates.clear();
    this.loadsByCircuit.clear();
  }

  // ----- private -----------------------------------------------------------

  private setLoadsPowered(circuitId: PowerCircuitId, powered: boolean): void {
    const loadIds = this.loadsByCircuit.get(circuitId) ?? [];
    for (const loadId of loadIds) {
      const state = this.loadStates.get(loadId);
      if (state === undefined || state.powered === powered) continue;
      state.powered = powered;
      this.emit({ kind: powered ? 'load-powered' : 'load-unpowered', loadId, circuitId });
    }
  }

  private emit(event: PowerEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow listener errors — never let UI code break domain state.
      }
    }
  }
}
