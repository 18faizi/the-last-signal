/**
 * Owns the receiver's full device state machine: power/boot, tuning
 * controls, the scripted scan sweep, and — per tuned channel — a
 * SignalLockController + DecodeController pair.
 *
 * Babylon/DOM-free, exactly like GeneratorController: powerOn/powerOff are
 * called by a PoweredStateBinding subscription owned by the scene (see
 * facilityReceiverBindings.ts), never by this class polling PowerNetwork
 * itself. Boot uses a scoped delta-time accumulator driven by update(dt),
 * ticked from a single onBeforeRenderObservable hook installed by
 * ReceiverInteractionTarget — mirrors GeneratorInteractionTargets' pattern
 * exactly, no raw setTimeout/setInterval anywhere.
 */
import type { SignalDefinition } from '../signal/SignalDefinition';
import type { SignalId } from '../signal/SignalId';
import {
  createDefaultReceiverControls,
  sanitizeReceiverControls,
  type ReceiverControls,
} from '../signal/ReceiverControls';
import { clampChannel, clampFrequency, clampPhase, clamp01 } from '../signal/SignalChannel';
import { evaluate } from '../signal/SignalEvaluator';
import type { ReceiverMetrics } from '../signal/ReceiverMetrics';
import { SignalLockController, type SignalLockState } from '../signal/SignalLockController';
import { DecodeController, type DecodeState } from '../signal/DecodeController';
import { SignalEventBus, type SignalEvent } from '../signal/SignalEvent';
import { SignalError } from '../signal/SignalError';
import { tryTransitionReceiverMode, type ReceiverMode } from './ReceiverMode';
import { DEFAULT_RECEIVER_DEFINITION, type ReceiverDefinition } from './ReceiverDefinition';

const MAX_RECEIVER_DT_SECONDS = 0.1;

interface SignalRuntimeEntry {
  readonly def: SignalDefinition;
  readonly lock: SignalLockController;
  readonly decode: DecodeController;
}

export interface ReceiverControllerSnapshot {
  readonly mode: ReceiverMode;
  readonly controls: Readonly<ReceiverControls>;
  readonly bootProgress: number;
  readonly isPanelOpen: boolean;
  readonly scanning: boolean;
  readonly activeSignalId: SignalId | null;
  readonly metrics: ReceiverMetrics | null;
  readonly lockState: SignalLockState;
  readonly acquisitionProgress: number;
  readonly holdQuality: number;
  readonly decodeState: DecodeState;
  readonly decodeProgress: number;
  readonly decodedSignalIds: readonly SignalId[];
}

export class ReceiverController {
  readonly definition: ReceiverDefinition;

  private readonly bySignalId = new Map<SignalId, SignalRuntimeEntry>();
  private readonly signalsByChannel = new Map<number, SignalDefinition>();
  private readonly decodedSignalIds = new Set<SignalId>();
  private readonly bus = new SignalEventBus();
  private readonly modeListeners = new Set<(mode: ReceiverMode) => void>();

  private mode: ReceiverMode = 'Offline';
  private controls: ReceiverControls = createDefaultReceiverControls();
  private bootElapsed = 0;
  private isPanelOpenFlag = false;
  private scanning = false;
  private scanElapsed = 0;
  private scanPauseRemaining = 0;
  private lastMetrics: ReceiverMetrics | null = null;

  constructor(definition: ReceiverDefinition = DEFAULT_RECEIVER_DEFINITION) {
    this.definition = definition;
    sanitizeReceiverControls(this.controls);
  }

  /** Registers a signal reachable on its own channel. One signal per channel. */
  registerSignal(def: SignalDefinition): void {
    if (this.bySignalId.has(def.id)) {
      throw new SignalError('duplicate-id', `ReceiverController: duplicate signal id "${def.id}"`);
    }
    if (this.signalsByChannel.has(def.channel)) {
      throw new SignalError(
        'invalid-definition',
        `ReceiverController: channel ${def.channel} already has a registered signal`,
      );
    }
    const lock = new SignalLockController({
      signalId: def.id,
      minLockQuality: def.minLockQuality,
      lockAcquisitionSeconds: def.lockAcquisitionSeconds,
    });
    const decode = new DecodeController({ signalId: def.id, decodeSeconds: def.decodeSeconds });
    lock.subscribe((event) => this.bus.emit(event));
    // Record completion into decodedSignalIds BEFORE forwarding the event
    // to external subscribers (e.g. facilityReceiverBindings.ts's
    // SignalPuzzleComplete check) — DecodeController fires 'DecodeCompleted'
    // synchronously from inside its own update() call, so a listener
    // reacting to the forwarded event must already see decodedSignalIds
    // updated, not find it stale until the next tick.
    decode.subscribe((event) => {
      if (event.kind === 'DecodeCompleted') {
        this.decodedSignalIds.add(def.id);
      }
      this.bus.emit(event);
    });
    this.bySignalId.set(def.id, { def, lock, decode });
    this.signalsByChannel.set(def.channel, def);
  }

  // ----- read --------------------------------------------------------------

  get receiverMode(): ReceiverMode {
    return this.mode;
  }

  get isPanelOpen(): boolean {
    return this.isPanelOpenFlag;
  }

  get isScanning(): boolean {
    return this.scanning;
  }

  get currentControls(): Readonly<ReceiverControls> {
    return this.controls;
  }

  getSignalDefinition(id: SignalId): SignalDefinition | undefined {
    return this.bySignalId.get(id)?.def;
  }

  isDecoded(id: SignalId): boolean {
    return this.decodedSignalIds.has(id);
  }

  getSnapshot(): ReceiverControllerSnapshot {
    const tunedDef = this.signalsByChannel.get(this.controls.channel);
    const tunedEntry = tunedDef !== undefined ? this.bySignalId.get(tunedDef.id) : undefined;
    return {
      mode: this.mode,
      controls: { ...this.controls },
      bootProgress:
        this.mode === 'Booting'
          ? clamp01(this.bootElapsed / Math.max(this.definition.bootSeconds, 1e-3))
          : this.mode === 'Offline'
            ? 0
            : 1,
      isPanelOpen: this.isPanelOpenFlag,
      scanning: this.scanning,
      activeSignalId: tunedDef?.id ?? null,
      metrics: tunedEntry !== undefined ? this.lastMetrics : null,
      lockState: tunedEntry?.lock.lockState ?? 'Searching',
      acquisitionProgress: tunedEntry?.lock.acquisitionProgress ?? 0,
      holdQuality: tunedEntry?.lock.holdQuality ?? 0,
      decodeState: tunedEntry?.decode.decodeState ?? 'Idle',
      decodeProgress: tunedEntry?.decode.decodeProgress ?? 0,
      decodedSignalIds: [...this.decodedSignalIds],
    };
  }

  // ----- power ---------------------------------------------------------------

  /** Called by facilityReceiverBindings' PoweredStateBinding subscription — never polled internally. */
  powerOn(): void {
    if (this.mode !== 'Offline') return;
    this.bootElapsed = 0;
    this.setMode('Booting');
  }

  /**
   * Power loss ALWAYS routes to Offline, regardless of current mode — a
   * real power cut stops the hardware outright. SignalLost is reserved for
   * a quality-driven lock loss while still powered (see ReceiverMode.ts).
   * Live lock/decode progress resets; already-decoded signals stay
   * remembered in `decodedSignalIds` (see open()'s fast-path restore) so
   * re-powering and reopening does not force re-decoding a signal already
   * fully decoded this session.
   */
  powerOff(): void {
    if (this.mode === 'Offline') return;
    for (const entry of this.bySignalId.values()) {
      entry.lock.reset();
      entry.decode.reset();
    }
    this.scanning = false;
    this.scanElapsed = 0;
    this.scanPauseRemaining = 0;
    this.isPanelOpenFlag = false;
    this.bootElapsed = 0;
    this.lastMetrics = null;
    this.setMode('Offline'); // every state's transition table includes Offline as a legal target
  }

  // ----- panel open/close -----------------------------------------------------

  /** Returns false when the receiver isn't powered/booted yet. */
  open(): boolean {
    if (this.mode === 'Offline' || this.mode === 'Booting' || this.mode === 'Fault') {
      return false;
    }
    this.isPanelOpenFlag = true;
    if (this.mode === 'Idle') {
      this.setMode('Tuning');
      this.restoreDecodedStateIfApplicable();
    }
    return true;
  }

  close(): void {
    this.isPanelOpenFlag = false;
  }

  // ----- tuning controls -------------------------------------------------------

  setChannel(channel: number): void {
    this.cancelScanIfActive();
    this.controls.channel = clampChannel(channel);
  }

  setFrequency(frequencyMHz: number): void {
    this.cancelScanIfActive();
    this.controls.frequencyMHz = clampFrequency(frequencyMHz);
  }

  adjustFrequency(deltaMHz: number): void {
    this.setFrequency(this.controls.frequencyMHz + deltaMHz);
  }

  setGain(gain: number): void {
    this.cancelScanIfActive();
    this.controls.gain = clamp01(gain);
  }

  adjustGain(delta: number): void {
    this.setGain(this.controls.gain + delta);
  }

  setFilter(filter: number): void {
    this.cancelScanIfActive();
    this.controls.filter = clamp01(filter);
  }

  adjustFilter(delta: number): void {
    this.setFilter(this.controls.filter + delta);
  }

  setPhase(phaseDeg: number): void {
    this.cancelScanIfActive();
    this.controls.phaseDeg = clampPhase(phaseDeg);
  }

  adjustPhase(delta: number): void {
    this.setPhase(this.controls.phaseDeg + delta);
  }

  /** "R" — resets tuning controls to defaults. Does not touch lock/decode progress directly. */
  resetControls(): void {
    this.cancelScanIfActive();
    this.controls = createDefaultReceiverControls();
  }

  // ----- scan ------------------------------------------------------------------

  /** Requires receiver power (mode === 'Tuning'); a no-op otherwise. */
  startScan(): boolean {
    if (this.mode !== 'Tuning') return false;
    this.scanning = true;
    this.scanElapsed = 0;
    this.scanPauseRemaining = 0;
    this.setMode('Scanning');
    return true;
  }

  cancelScan(): void {
    this.cancelScanIfActive();
  }

  // ----- per-frame tick ----------------------------------------------------------

  update(deltaSecondsRaw: number): void {
    const dt = Math.min(Math.max(deltaSecondsRaw, 0), MAX_RECEIVER_DT_SECONDS);

    if (this.mode === 'Offline' || this.mode === 'Fault') return;

    if (this.mode === 'Booting') {
      this.bootElapsed += dt;
      if (this.bootElapsed >= this.definition.bootSeconds) {
        this.setMode('Idle');
      }
      return;
    }

    if (this.mode === 'Idle') return; // nothing to tick until the panel is opened at least once

    if (this.scanning) {
      this.tickScan(dt);
    }

    const tunedDef = this.signalsByChannel.get(this.controls.channel);
    let tunedEntry: SignalRuntimeEntry | undefined;

    for (const entry of this.bySignalId.values()) {
      const isTuned = tunedDef !== undefined && entry.def.id === tunedDef.id;
      const metrics = isTuned ? evaluate(entry.def, this.controls) : null;
      if (isTuned) {
        tunedEntry = entry;
        this.lastMetrics = metrics;
      }

      const lockStateBefore = entry.lock.lockState;
      entry.lock.update(dt, metrics?.overallQuality ?? 0);
      const lockStateAfter = entry.lock.lockState;
      const justAcquiredLock = lockStateBefore !== 'Locked' && lockStateAfter === 'Locked';

      // Reconcile immediately after the lock tick so 'Locked' is a real,
      // externally-observable mode for at least one full update() call
      // before decode begins — otherwise DecodeController (which starts
      // accumulating the instant holdQuality is full) would make 'Locked'
      // and 'Decoding' collapse into the same tick, and the player would
      // never see a distinct LOCKED status (the UI explicitly lists LOCKED
      // and DECODING as separate states). Skipping decode.update() on the
      // exact tick lock is first acquired creates that one-tick gap.
      if (isTuned && !this.scanning) {
        this.reconcileModeFromEntry(entry);
      }
      if (justAcquiredLock) {
        continue;
      }

      entry.decode.update(dt, entry.lock.lockState, entry.lock.holdQuality);
      // Defensive/idempotent: registerSignal()'s decode subscription
      // already records completion synchronously as the event fires, so
      // this is normally a no-op — kept as a fallback for the case decode
      // was already Completed on entry to this tick.
      if (entry.decode.isCompleted && !this.decodedSignalIds.has(entry.def.id)) {
        this.decodedSignalIds.add(entry.def.id);
      }
      if (isTuned && !this.scanning) {
        this.reconcileModeFromEntry(entry);
      }
    }

    if (!this.scanning && tunedEntry === undefined && this.mode !== 'Tuning') {
      this.lastMetrics = null;
      this.setMode('Tuning');
    }
  }

  /** Dev/test-only fault injection — never reached through normal play. */
  simulateFault(): void {
    this.setMode('Fault');
  }

  /** Full device reset (dev "full reset" action only). */
  reset(): void {
    this.mode = 'Offline';
    this.controls = createDefaultReceiverControls();
    this.bootElapsed = 0;
    this.isPanelOpenFlag = false;
    this.scanning = false;
    this.scanElapsed = 0;
    this.scanPauseRemaining = 0;
    this.lastMetrics = null;
    this.decodedSignalIds.clear();
    for (const entry of this.bySignalId.values()) {
      entry.lock.reset();
      entry.decode.reset();
    }
  }

  subscribe(listener: (event: SignalEvent) => void): () => void {
    return this.bus.subscribe(listener);
  }

  /** Notified whenever receiverMode actually changes (e.g. for world material bindings). */
  subscribeMode(listener: (mode: ReceiverMode) => void): () => void {
    this.modeListeners.add(listener);
    return () => this.modeListeners.delete(listener);
  }

  dispose(): void {
    this.bus.dispose();
    this.modeListeners.clear();
    for (const entry of this.bySignalId.values()) {
      entry.lock.dispose();
      entry.decode.dispose();
    }
  }

  // ----- private ---------------------------------------------------------------

  private cancelScanIfActive(): void {
    if (!this.scanning) return;
    this.scanning = false;
    if (this.mode === 'Scanning') {
      this.setMode('Tuning');
    }
  }

  private tickScan(dt: number): void {
    if (this.scanPauseRemaining > 0) {
      this.scanPauseRemaining = Math.max(0, this.scanPauseRemaining - dt);
      return;
    }
    this.scanElapsed += dt;
    const totalChannels = this.definition.maxChannel - this.definition.minChannel + 1;
    const perChannelSeconds = this.definition.scanSweepSeconds / totalChannels;
    const cycleSeconds = this.definition.scanSweepSeconds;
    const t = this.scanElapsed % cycleSeconds;
    const channelIndex = Math.floor(t / perChannelSeconds) % totalChannels;
    const channel = this.definition.minChannel + channelIndex;
    const withinChannelT = (t % perChannelSeconds) / perChannelSeconds;
    const freqRange = this.definition.maxFrequencyMHz - this.definition.minFrequencyMHz;
    const frequency = this.definition.minFrequencyMHz + withinChannelT * freqRange;

    this.controls.channel = channel;
    this.controls.frequencyMHz = frequency;

    if (channel === this.definition.scanActivityChannel) {
      const tunedDef = this.signalsByChannel.get(channel);
      if (
        tunedDef !== undefined &&
        Math.abs(frequency - tunedDef.targetFrequencyMHz) <= tunedDef.frequencyToleranceMHz * 3
      ) {
        this.scanPauseRemaining = this.definition.scanPauseSeconds;
        this.bus.emit({ kind: 'ChannelActivityDetected', signalId: tunedDef.id, channel });
      }
    }
  }

  private reconcileModeFromEntry(entry: SignalRuntimeEntry): void {
    const lockState = entry.lock.lockState;
    const decodeState = entry.decode.decodeState;
    let desired: ReceiverMode;
    if (decodeState === 'Completed') {
      desired = 'Decoded';
    } else if (lockState === 'Locked') {
      desired = decodeState === 'Idle' ? 'Locked' : 'Decoding';
    } else if (lockState === 'Lost') {
      desired = 'SignalLost';
    } else {
      desired = 'Tuning';
    }
    if (desired !== this.mode) {
      this.setMode(desired);
    }
  }

  /**
   * Fast-path when (re)opening the panel on a channel whose signal was
   * already fully decoded earlier this power cycle — a real receiver would
   * still have the last-decoded transmission buffered, so re-tuning from
   * scratch to re-read a transcript you already decoded would be poor UX,
   * not a genuine gameplay requirement.
   */
  private restoreDecodedStateIfApplicable(): void {
    const tunedDef = this.signalsByChannel.get(this.controls.channel);
    if (tunedDef === undefined || !this.decodedSignalIds.has(tunedDef.id)) return;
    const entry = this.bySignalId.get(tunedDef.id);
    if (entry === undefined || entry.decode.isCompleted) return;
    // Drive both sub-controllers to their completed state at full quality —
    // each update() call is internally dt-clamped to MAX_LOCK_DT_SECONDS, so
    // these are bounded loops (lockAcquisitionSeconds/decodeSeconds ÷ 0.1
    // iterations), never unbounded.
    const lockIterationCap =
      Math.ceil(entry.def.lockAcquisitionSeconds / MAX_RECEIVER_DT_SECONDS) + 2;
    for (let i = 0; i < lockIterationCap && entry.lock.lockState !== 'Locked'; i++) {
      entry.lock.update(MAX_RECEIVER_DT_SECONDS, 1);
    }
    const decodeIterationCap = Math.ceil(entry.def.decodeSeconds / MAX_RECEIVER_DT_SECONDS) + 2;
    for (let i = 0; i < decodeIterationCap && !entry.decode.isCompleted; i++) {
      entry.decode.update(MAX_RECEIVER_DT_SECONDS, entry.lock.lockState, entry.lock.holdQuality);
    }
    this.setMode('Locked');
    this.setMode('Decoding');
    this.setMode('Decoded');
  }

  private setMode(target: ReceiverMode): void {
    const next = tryTransitionReceiverMode(this.mode, target);
    if (next === null) return;
    this.mode = next;
    for (const listener of this.modeListeners) {
      try {
        listener(next);
      } catch {
        // Swallow — never let a UI/test listener break domain state.
      }
    }
  }
}
