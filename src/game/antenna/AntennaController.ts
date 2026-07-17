/**
 * Owns AntennaMechanicalState + AntennaControlState for every registered
 * array, the current array selection, and rooftop power state. Babylon/DOM-
 * free, exactly like ReceiverController: powerOn/powerOff are called by a
 * PoweredStateBinding subscription owned by the scene (see
 * facilityAntennaBindings.ts), never by this class polling PowerNetwork
 * itself. Waveguide continuity per array is likewise pushed in via
 * setWaveguideQuality() by a WaveguideController subscription in the same
 * scene-wiring file — this class never imports WaveguideController/
 * PowerNetwork directly, keeping the antenna/waveguide/power domains
 * sibling-decoupled (composed only by the scene layer).
 *
 * Movement is frame-rate independent (see tickAxis()'s doc comment) and
 * ticked from a single onBeforeRenderObservable hook installed by the
 * antenna world-adapter (mirrors ReceiverInteractionTarget's pattern
 * exactly) — no raw setTimeout/setInterval anywhere.
 */
import type { AntennaArrayDefinition } from './AntennaArrayDefinition';
import type { AntennaArrayId } from './AntennaArrayId';
import {
  isAntennaArrayPowered,
  tryTransitionAntennaControlState,
  type AntennaControlState,
} from './AntennaControlState';
import {
  cloneAntennaMechanicalState,
  createDefaultAntennaMechanicalState,
  type AntennaMechanicalState,
} from './AntennaMechanicalState';
import type { AntennaMetrics } from './AntennaMetrics';
import { evaluate } from './AntennaEvaluator';
import { AntennaEventBus, type AntennaEvent } from './AntennaEvent';
import { AntennaError } from './AntennaError';
import { clamp, clamp01 } from './AntennaMath';
import type { AntennaArraySnapshot, AntennaControllerSnapshot } from './AntennaSnapshot';

export const MAX_ANTENNA_DT_SECONDS = 0.1;
/**
 * Aligned/AlignedCandidate thresholds are RATIOS of the array's OWN
 * maxQuality, not fixed absolute values — arrays deliberately have very
 * different maxQuality ceilings (spec §10: North Dish's ceiling is
 * intentionally low), so a fixed absolute threshold (e.g. 0.85) would make
 * a low-ceiling array structurally unable to ever reach 'Aligned' even at
 * perfect, settled, fully-powered alignment. Ratios keep "aligned" meaning
 * "as good as this array can get", consistently across every array.
 */
export const ALIGNED_QUALITY_RATIO = 0.9;
export const CANDIDATE_QUALITY_RATIO = 0.4;

interface ArrayRuntimeEntry {
  readonly def: AntennaArrayDefinition;
  mechanical: AntennaMechanicalState;
  controlState: AntennaControlState;
  waveguideQuality: number;
  metrics: AntennaMetrics | null;
  readonly parkAzimuthDeg: number;
  readonly parkElevationDeg: number;
  readonly parkPolarizationDeg: number;
}

/**
 * Moves `current` toward `target` at `speedDegPerSecond`, clamped to
 * [min, max]. Frame-rate independent: the distance covered is always
 * exactly `speed * dt` regardless of step granularity, and arrival SNAPS
 * exactly to `target` (never accumulates a residual), so repeated
 * move-to-same-target calls can never drift — the tested no-drift guarantee.
 * Movement is deliberately LINEAR within the array's defined range, never
 * wraparound — see AntennaEvaluator.ts's doc comment for why circular
 * azimuth math is used only for quality scoring, not for the physical
 * motor's travel path (these arrays' ranges are bounded and never need to
 * cross the ±180° seam in flight).
 */
function tickAxis(
  current: number,
  target: number,
  speedDegPerSecond: number,
  dt: number,
  min: number,
  max: number,
): { value: number; arrived: boolean } {
  const remaining = target - current;
  if (remaining === 0) return { value: current, arrived: true };
  const maxStep = Math.max(speedDegPerSecond, 0) * Math.max(dt, 0);
  if (maxStep >= Math.abs(remaining)) {
    return { value: clamp(target, min, max), arrived: true };
  }
  return { value: clamp(current + Math.sign(remaining) * maxStep, min, max), arrived: false };
}

export class AntennaController {
  private readonly arrays = new Map<AntennaArrayId, ArrayRuntimeEntry>();
  private selectedArrayId: AntennaArrayId | null = null;
  private powered = false;
  private readonly bus = new AntennaEventBus();

  registerArray(def: AntennaArrayDefinition): void {
    if (this.arrays.has(def.id)) {
      throw new AntennaError('duplicate-id', `AntennaController: duplicate array id "${def.id}"`);
    }
    // Parked at each axis's MINIMUM bound (not 0) — deliberately maximally
    // far from a reasonably-centered target, so the default position can
    // never accidentally land inside an array's quality plateau (see
    // AntennaValidation.ts's "default position not accidentally aligned"
    // check, which depends on this).
    const parkAzimuthDeg = def.minAzimuthDeg;
    const parkElevationDeg = def.minElevationDeg;
    const parkPolarizationDeg = def.minPolarizationDeg;
    this.arrays.set(def.id, {
      def,
      mechanical: createDefaultAntennaMechanicalState(
        parkAzimuthDeg,
        parkElevationDeg,
        parkPolarizationDeg,
      ),
      controlState: 'Offline',
      waveguideQuality: 0,
      metrics: null,
      parkAzimuthDeg,
      parkElevationDeg,
      parkPolarizationDeg,
    });
  }

  // ----- read --------------------------------------------------------------

  get selectedArray(): AntennaArrayId | null {
    return this.selectedArrayId;
  }

  get isPowered(): boolean {
    return this.powered;
  }

  listArrayIds(): readonly AntennaArrayId[] {
    return [...this.arrays.keys()];
  }

  getDefinition(id: AntennaArrayId): AntennaArrayDefinition | undefined {
    return this.arrays.get(id)?.def;
  }

  getControlState(id: AntennaArrayId): AntennaControlState {
    return this.arrays.get(id)?.controlState ?? 'Offline';
  }

  getMechanicalState(id: AntennaArrayId): Readonly<AntennaMechanicalState> | undefined {
    const entry = this.arrays.get(id);
    return entry !== undefined ? cloneAntennaMechanicalState(entry.mechanical) : undefined;
  }

  getMetrics(id: AntennaArrayId): AntennaMetrics | null {
    return this.arrays.get(id)?.metrics ?? null;
  }

  getSnapshot(): AntennaControllerSnapshot {
    return {
      selectedArrayId: this.selectedArrayId,
      powered: this.powered,
      arrays: [...this.arrays.entries()].map(([id, entry]): AntennaArraySnapshot => ({
        id,
        controlState: entry.controlState,
        mechanical: cloneAntennaMechanicalState(entry.mechanical),
        metrics: entry.metrics,
      })),
    };
  }

  // ----- power ---------------------------------------------------------------

  /** Called by facilityAntennaBindings' PoweredStateBinding subscription — never polled internally. */
  powerOn(): void {
    if (this.powered) return;
    this.powered = true;
    for (const [id, entry] of this.arrays) {
      const target: AntennaControlState = entry.def.selectable ? 'Idle' : 'Unavailable';
      this.setControlState(id, entry, target);
    }
    this.bus.emit({ kind: 'PowerRestored' });
    this.recomputeAllMetrics();
  }

  /**
   * Power loss ALWAYS routes every array to Offline. Mid-transit movement is
   * frozen with its CURRENT position preserved exactly, but the commanded
   * target is cleared — restored power does NOT auto-resume motion, the
   * player must explicitly re-command it (spec constraint).
   */
  powerOff(): void {
    if (!this.powered) return;
    this.powered = false;
    for (const [id, entry] of this.arrays) {
      entry.mechanical.targetAzimuthDeg = null;
      entry.mechanical.targetElevationDeg = null;
      entry.mechanical.targetPolarizationDeg = null;
      this.setControlState(id, entry, 'Offline');
    }
    this.bus.emit({ kind: 'PowerLost' });
    this.recomputeAllMetrics();
  }

  // ----- waveguide feed ---------------------------------------------------

  /** Called by facilityAntennaBindings' WaveguideController subscription — event-driven, never per-frame. */
  setWaveguideQuality(id: AntennaArrayId, quality: number): void {
    const entry = this.arrays.get(id);
    if (entry === undefined) return;
    entry.waveguideQuality = clamp01(quality);
    this.recomputeMetrics(id, entry);
  }

  // ----- selection ---------------------------------------------------------

  selectArray(id: AntennaArrayId): boolean {
    if (!this.powered) return false;
    const entry = this.arrays.get(id);
    if (entry === undefined || !entry.def.selectable) return false;
    if (entry.controlState === 'Offline' || entry.controlState === 'Fault') return false;
    this.selectedArrayId = id;
    this.bus.emit({ kind: 'ArraySelected', arrayId: id });
    this.recomputeAllMetrics();
    return true;
  }

  // ----- movement commands (apply to the currently selected array only) ---------

  setAzimuth(deg: number): boolean {
    return this.commandAxis('azimuth', deg);
  }

  adjustAzimuth(deltaDeg: number): boolean {
    const entry = this.selectedEntry();
    if (entry === null) return false;
    const base = entry.mechanical.targetAzimuthDeg ?? entry.mechanical.currentAzimuthDeg;
    return this.setAzimuth(base + deltaDeg);
  }

  setElevation(deg: number): boolean {
    return this.commandAxis('elevation', deg);
  }

  adjustElevation(deltaDeg: number): boolean {
    const entry = this.selectedEntry();
    if (entry === null) return false;
    const base = entry.mechanical.targetElevationDeg ?? entry.mechanical.currentElevationDeg;
    return this.setElevation(base + deltaDeg);
  }

  setPolarization(deg: number): boolean {
    return this.commandAxis('polarization', deg);
  }

  adjustPolarization(deltaDeg: number): boolean {
    const entry = this.selectedEntry();
    if (entry === null) return false;
    const base = entry.mechanical.targetPolarizationDeg ?? entry.mechanical.currentPolarizationDeg;
    return this.setPolarization(base + deltaDeg);
  }

  /** Commands the selected array to its parked (default) position. */
  park(): boolean {
    const entry = this.selectedEntry();
    if (entry === null) return false;
    this.setAzimuth(entry.parkAzimuthDeg);
    this.setElevation(entry.parkElevationDeg);
    this.setPolarization(entry.parkPolarizationDeg);
    return true;
  }

  /** Halts the selected array's motion in place, preserving its current position. */
  emergencyStop(): void {
    const id = this.selectedArrayId;
    const entry = this.selectedEntry();
    if (id === null || entry === null) return;
    entry.mechanical.targetAzimuthDeg = null;
    entry.mechanical.targetElevationDeg = null;
    entry.mechanical.targetPolarizationDeg = null;
    entry.mechanical.emergencyStopped = true;
    this.setControlState(id, entry, 'Idle');
    this.bus.emit({ kind: 'EmergencyStopped', arrayId: id });
    this.bus.emit({ kind: 'MovementStopped', arrayId: id });
    this.recomputeMetrics(id, entry);
  }

  // ----- per-frame tick ----------------------------------------------------------

  update(dtSecondsRaw: number): void {
    const dt = Math.min(Math.max(dtSecondsRaw, 0), MAX_ANTENNA_DT_SECONDS);
    if (!this.powered || this.selectedArrayId === null) return;
    const id = this.selectedArrayId;
    const entry = this.arrays.get(id);
    if (entry === undefined || entry.mechanical.emergencyStopped) return;

    const mech = entry.mechanical;
    const wasMidTransit =
      mech.targetAzimuthDeg !== null ||
      mech.targetElevationDeg !== null ||
      mech.targetPolarizationDeg !== null;

    if (mech.targetAzimuthDeg !== null) {
      const { value, arrived } = tickAxis(
        mech.currentAzimuthDeg,
        mech.targetAzimuthDeg,
        entry.def.azimuthSpeedDegPerSecond,
        dt,
        entry.def.minAzimuthDeg,
        entry.def.maxAzimuthDeg,
      );
      mech.currentAzimuthDeg = value;
      if (arrived) mech.targetAzimuthDeg = null;
    }
    if (mech.targetElevationDeg !== null) {
      const { value, arrived } = tickAxis(
        mech.currentElevationDeg,
        mech.targetElevationDeg,
        entry.def.elevationSpeedDegPerSecond,
        dt,
        entry.def.minElevationDeg,
        entry.def.maxElevationDeg,
      );
      mech.currentElevationDeg = value;
      if (arrived) mech.targetElevationDeg = null;
    }
    if (mech.targetPolarizationDeg !== null) {
      const { value, arrived } = tickAxis(
        mech.currentPolarizationDeg,
        mech.targetPolarizationDeg,
        entry.def.polarizationSpeedDegPerSecond,
        dt,
        entry.def.minPolarizationDeg,
        entry.def.maxPolarizationDeg,
      );
      mech.currentPolarizationDeg = value;
      if (arrived) mech.targetPolarizationDeg = null;
    }

    const stillMidTransit =
      mech.targetAzimuthDeg !== null ||
      mech.targetElevationDeg !== null ||
      mech.targetPolarizationDeg !== null;

    if (wasMidTransit && !stillMidTransit) {
      mech.parked =
        mech.currentAzimuthDeg === entry.parkAzimuthDeg &&
        mech.currentElevationDeg === entry.parkElevationDeg &&
        mech.currentPolarizationDeg === entry.parkPolarizationDeg;
      this.bus.emit({ kind: 'MovementCompleted', arrayId: id });
    }

    this.recomputeMetrics(id, entry);
  }

  /** Dev-only fault injection — never reached through normal play. */
  simulateFault(): void {
    if (this.selectedArrayId === null) return;
    const entry = this.arrays.get(this.selectedArrayId);
    if (entry === undefined) return;
    this.setControlState(this.selectedArrayId, entry, 'Fault');
  }

  /** Full device reset (dev "full reset" action only). */
  reset(): void {
    this.selectedArrayId = null;
    this.powered = false;
    for (const entry of this.arrays.values()) {
      entry.mechanical = createDefaultAntennaMechanicalState(
        entry.parkAzimuthDeg,
        entry.parkElevationDeg,
        entry.parkPolarizationDeg,
      );
      entry.waveguideQuality = 0;
      entry.metrics = null;
      // Reset directly (not via the transition table — a full reset must
      // always succeed regardless of the current state).
      entry.controlState = 'Offline';
    }
  }

  subscribe(listener: (event: AntennaEvent) => void): () => void {
    return this.bus.subscribe(listener);
  }

  dispose(): void {
    this.bus.dispose();
  }

  // ----- private ---------------------------------------------------------------

  private selectedEntry(): ArrayRuntimeEntry | null {
    if (this.selectedArrayId === null) return null;
    return this.arrays.get(this.selectedArrayId) ?? null;
  }

  private commandAxis(axis: 'azimuth' | 'elevation' | 'polarization', deg: number): boolean {
    const id = this.selectedArrayId;
    const entry = this.selectedEntry();
    if (id === null || entry === null || !this.powered) return false;
    if (entry.controlState === 'Offline' || entry.controlState === 'Fault') return false;

    const mech = entry.mechanical;
    mech.emergencyStopped = false; // an explicit new command clears a prior e-stop.
    mech.parked = false;

    const wasMidTransit =
      mech.targetAzimuthDeg !== null ||
      mech.targetElevationDeg !== null ||
      mech.targetPolarizationDeg !== null;

    if (axis === 'azimuth') {
      mech.targetAzimuthDeg = clamp(deg, entry.def.minAzimuthDeg, entry.def.maxAzimuthDeg);
    } else if (axis === 'elevation') {
      mech.targetElevationDeg = clamp(deg, entry.def.minElevationDeg, entry.def.maxElevationDeg);
    } else {
      mech.targetPolarizationDeg = clamp(
        deg,
        entry.def.minPolarizationDeg,
        entry.def.maxPolarizationDeg,
      );
    }

    if (!wasMidTransit) {
      this.bus.emit({ kind: 'MovementStarted', arrayId: id });
    }
    this.setControlState(id, entry, 'Moving');
    this.recomputeMetrics(id, entry);
    return true;
  }

  private recomputeAllMetrics(): void {
    for (const [id, entry] of this.arrays) {
      this.recomputeMetrics(id, entry);
    }
  }

  private recomputeMetrics(id: AntennaArrayId, entry: ArrayRuntimeEntry): void {
    const metrics = evaluate(entry.def, {
      activeArrayId: this.selectedArrayId ?? id,
      mechanical: entry.mechanical,
      waveguideQuality: entry.waveguideQuality,
      powered: this.powered && isAntennaArrayPowered(entry.controlState),
    });
    entry.metrics = metrics;

    // 'Aligned'/'AlignedCandidate' are DERIVED from quality, never set
    // directly — only meaningful for the currently-selected, POWERED array.
    // Reconciliation is driven by whether motion is ACTUALLY mid-transit
    // right now (not by the array's current control-state label) — using
    // the label itself as the guard was a bug: once 'Moving' was set by
    // commandAxis(), nothing would ever reconcile it back OUT of 'Moving'
    // after arrival, since this very check would keep skipping itself.
    if (
      this.selectedArrayId === id &&
      entry.controlState !== 'Offline' &&
      entry.controlState !== 'Fault'
    ) {
      const midTransit =
        entry.mechanical.targetAzimuthDeg !== null ||
        entry.mechanical.targetElevationDeg !== null ||
        entry.mechanical.targetPolarizationDeg !== null;
      const alignedFloor = entry.def.maxQuality * ALIGNED_QUALITY_RATIO;
      const candidateFloor = entry.def.maxQuality * CANDIDATE_QUALITY_RATIO;
      const desired: AntennaControlState = midTransit
        ? 'Moving'
        : metrics.overallQuality >= alignedFloor
          ? 'Aligned'
          : metrics.overallQuality >= candidateFloor
            ? 'AlignedCandidate'
            : 'Idle';
      this.setControlState(id, entry, desired);
    }
  }

  private setControlState(
    id: AntennaArrayId,
    entry: ArrayRuntimeEntry,
    target: AntennaControlState,
  ): void {
    if (entry.controlState === target) return;
    const next = tryTransitionAntennaControlState(entry.controlState, target);
    if (next === null) return;
    const wasAligned = entry.controlState === 'Aligned';
    entry.controlState = next;
    if (next === 'Aligned' && !wasAligned) {
      if (entry.metrics !== null) {
        this.bus.emit({ kind: 'Aligned', arrayId: id, quality: entry.metrics.overallQuality });
      } else {
        this.bus.emit({ kind: 'Aligned', arrayId: id });
      }
    } else if (wasAligned && next !== 'Aligned') {
      this.bus.emit({ kind: 'AlignmentLost', arrayId: id });
    }
  }
}
