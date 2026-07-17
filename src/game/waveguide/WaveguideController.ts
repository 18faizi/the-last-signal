/**
 * Owns route/port selection + derived continuity state for every registered
 * waveguide path. Babylon/DOM-free, exactly like AntennaController — the
 * junction-box interaction target (game/antenna/AntennaJunctionTarget.ts)
 * is the one sanctioned mesh-touching adapter that calls into this class,
 * mirroring GeneratorInteractionTargets.ts's precedent.
 *
 * State is derived deterministically from "does the current port match the
 * correct port" — there is no separate transition table to maintain in
 * sync, which is the whole reason WaveguideState doesn't need one (see its
 * doc comment).
 */
import type { WaveguideDefinition, WaveguideRoutePort } from './WaveguideDefinition';
import { continuityForWaveguideState, type WaveguideState } from './WaveguideState';
import { WaveguideEventBus, type WaveguideEvent } from './WaveguideEvent';

interface WaveguideRuntimeEntry {
  readonly def: WaveguideDefinition;
  currentPortId: string;
  state: WaveguideState;
}

export interface WaveguidePathSnapshot {
  readonly id: string;
  readonly currentPortId: string;
  readonly state: WaveguideState;
  readonly continuity: number;
}

export class WaveguideController {
  private readonly paths = new Map<string, WaveguideRuntimeEntry>();
  private readonly bus = new WaveguideEventBus();

  registerPath(def: WaveguideDefinition): void {
    if (this.paths.has(def.id)) {
      throw new Error(`WaveguideController: duplicate waveguide path id "${def.id}"`);
    }
    this.paths.set(def.id, {
      def,
      currentPortId: def.defaultPortId,
      state: def.defaultState,
    });
  }

  // ----- read --------------------------------------------------------------

  listPathIds(): readonly string[] {
    return [...this.paths.keys()];
  }

  getDefinition(id: string): WaveguideDefinition | undefined {
    return this.paths.get(id)?.def;
  }

  getState(id: string): WaveguideState {
    return this.paths.get(id)?.state ?? 'Disconnected';
  }

  getCurrentPortId(id: string): string | undefined {
    return this.paths.get(id)?.currentPortId;
  }

  /** 0-1 graded continuity contribution for the given path. */
  getContinuity(id: string): number {
    const entry = this.paths.get(id);
    return entry !== undefined ? continuityForWaveguideState(entry.state) : 0;
  }

  listPortOptions(id: string): readonly WaveguideRoutePort[] {
    return this.paths.get(id)?.def.ports ?? [];
  }

  getSnapshot(id: string): WaveguidePathSnapshot | undefined {
    const entry = this.paths.get(id);
    if (entry === undefined) return undefined;
    return {
      id,
      currentPortId: entry.currentPortId,
      state: entry.state,
      continuity: continuityForWaveguideState(entry.state),
    };
  }

  getAllSnapshots(): readonly WaveguidePathSnapshot[] {
    return this.listPathIds()
      .map((id) => this.getSnapshot(id))
      .filter((s): s is WaveguidePathSnapshot => s !== undefined);
  }

  // ----- write ---------------------------------------------------------------

  /** Explicitly sets the route to a given port id. Returns false for an unknown path/port. */
  setPort(id: string, portId: string): boolean {
    const entry = this.paths.get(id);
    if (entry === undefined) return false;
    if (!entry.def.ports.some((p) => p.id === portId)) return false;
    this.applyPort(id, entry, portId);
    return true;
  }

  /** Cycles to the next candidate port (wraps around) — the junction box's single-press interaction. */
  cyclePort(id: string): boolean {
    const entry = this.paths.get(id);
    if (entry === undefined || entry.def.ports.length === 0) return false;
    const index = entry.def.ports.findIndex((p) => p.id === entry.currentPortId);
    const nextIndex = (index + 1) % entry.def.ports.length;
    const nextPort = entry.def.ports[nextIndex];
    if (nextPort === undefined) return false;
    this.applyPort(id, entry, nextPort.id);
    return true;
  }

  /** Full reset to each path's default port/state (dev "full reset" action only). */
  reset(): void {
    for (const entry of this.paths.values()) {
      entry.currentPortId = entry.def.defaultPortId;
      entry.state = entry.def.defaultState;
    }
  }

  subscribe(listener: (event: WaveguideEvent) => void): () => void {
    return this.bus.subscribe(listener);
  }

  dispose(): void {
    this.bus.dispose();
  }

  // ----- private ---------------------------------------------------------------

  private applyPort(id: string, entry: WaveguideRuntimeEntry, portId: string): void {
    if (entry.currentPortId === portId) return;
    const wasConnected = entry.state === 'Connected';
    entry.currentPortId = portId;
    entry.state = portId === entry.def.correctPortId ? 'Connected' : 'Misrouted';
    this.bus.emit({ kind: 'RouteChanged', pathId: id, portId });
    if (entry.state === 'Connected' && !wasConnected) {
      this.bus.emit({ kind: 'RouteCorrected', pathId: id, portId });
    } else if (wasConnected && entry.state !== 'Connected') {
      this.bus.emit({ kind: 'RouteBroken', pathId: id, portId });
    }
  }
}
