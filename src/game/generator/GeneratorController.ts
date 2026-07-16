/**
 * Owns the full generator control panel state machine.
 *
 * Babylon-free: the starter "hold" is driven by the existing HoldInteraction
 * framework (M0.3) via GeneratorInteractionTargets — this controller only
 * exposes a synchronous `attemptStart()` called on hold completion. Warm-up
 * and stop-down use a scoped, disposable accumulator driven by `update(dt)`,
 * which the Babylon-facing adapter calls from a single onBeforeRenderObservable
 * hook (mirrors DoorController.update()) — no raw setTimeout/setInterval.
 */
import type { GeneratorDefinition } from './GeneratorDefinition';
import { DEFAULT_GENERATOR_DEFINITION } from './GeneratorDefinition';
import { tryTransitionGeneratorState, type GeneratorState } from './GeneratorState';
import type { GeneratorEvent, GeneratorEventKind } from './GeneratorEvent';
import { evaluateStartupReadiness, type StartupReadiness } from './GeneratorStartupSequence';

export type FuelValveState = 'Closed' | 'Open';
/**
 * Simplified per M0.6 scope (see docs/architecture/generator-state-model.md):
 * the battery "starts disconnected but charged", so connecting always
 * succeeds immediately — there is no separate charge-up delay, hence no
 * distinct 'Ready' value beyond 'Connected'. 'Depleted' exists as a terminal
 * fault state reachable only via simulateDepletion() (test/fault-injection
 * hook), never through normal play — this milestone explicitly excludes
 * real electrical simulation.
 */
export type StarterBatteryState = 'Disconnected' | 'Connected' | 'Depleted';
export type EmergencyStopState = 'Engaged' | 'Released';
export type ControlSelectorState = 'Off' | 'Manual' | 'Automatic';
export type MainBreakerState = 'Open' | 'Closed';

export interface GeneratorControllerSnapshot {
  readonly state: GeneratorState;
  readonly fuelValve: FuelValveState;
  readonly starterBattery: StarterBatteryState;
  readonly emergencyStop: EmergencyStopState;
  readonly selector: ControlSelectorState;
  readonly mainBreaker: MainBreakerState;
  readonly warmUpProgress: number; // 0..1, only meaningful in RunningUnstable
  readonly inspected: boolean;
}

type GeneratorListener = (event: GeneratorEvent) => void;

export class GeneratorController {
  readonly definition: GeneratorDefinition;

  private state: GeneratorState = 'Offline';
  private fuelValve: FuelValveState = 'Closed';
  private starterBattery: StarterBatteryState = 'Disconnected';
  private emergencyStop: EmergencyStopState = 'Engaged';
  private selector: ControlSelectorState = 'Off';
  private mainBreaker: MainBreakerState = 'Open';
  private inspected = false;

  private warmUpElapsed = 0;
  private stopElapsed = 0;

  private readonly listeners = new Set<GeneratorListener>();

  constructor(definition: GeneratorDefinition = DEFAULT_GENERATOR_DEFINITION) {
    this.definition = definition;
  }

  // ----- read --------------------------------------------------------------

  get generatorState(): GeneratorState {
    return this.state;
  }

  get snapshot(): GeneratorControllerSnapshot {
    return {
      state: this.state,
      fuelValve: this.fuelValve,
      starterBattery: this.starterBattery,
      emergencyStop: this.emergencyStop,
      selector: this.selector,
      mainBreaker: this.mainBreaker,
      warmUpProgress:
        this.state === 'RunningUnstable'
          ? Math.min(1, this.warmUpElapsed / Math.max(this.definition.warmUpSeconds, 1e-3))
          : this.state === 'Running'
            ? 1
            : 0,
      inspected: this.inspected,
    };
  }

  get readiness(): StartupReadiness {
    return evaluateStartupReadiness({
      fuelValve: this.fuelValve,
      starterBattery: this.starterBattery,
      emergencyStop: this.emergencyStop,
      selector: this.selector,
    });
  }

  // ----- controls ------------------------------------------------------------

  /** Marks the status panel as read; advances Offline → InspectionRequired → NotReady. */
  inspect(): void {
    const alreadyInspected = this.inspected;
    this.inspected = true;
    if (this.state === 'Offline') {
      this.setState('InspectionRequired'); // emits GeneratorInspected
      this.setState('NotReady');
    } else if (alreadyInspected) {
      // Re-inspecting after the initial gate still surfaces the event so the
      // status panel can refresh without changing state.
      this.emit({ kind: 'GeneratorInspected' });
    }
    this.reevaluateReadiness();
  }

  openFuelValve(): void {
    if (this.fuelValve === 'Open') return;
    this.fuelValve = 'Open';
    this.emit({ kind: 'ControlChanged', control: 'fuelValve', value: 'Open' });
    this.reevaluateReadiness();
  }

  closeFuelValve(): void {
    if (this.fuelValve === 'Closed') return;
    this.fuelValve = 'Closed';
    this.emit({ kind: 'ControlChanged', control: 'fuelValve', value: 'Closed' });
    this.reevaluateReadiness();
  }

  connectBattery(): void {
    if (this.starterBattery === 'Depleted' || this.starterBattery === 'Connected') return;
    this.starterBattery = 'Connected';
    this.emit({ kind: 'ControlChanged', control: 'starterBattery', value: 'Connected' });
    this.reevaluateReadiness();
  }

  disconnectBattery(): void {
    if (this.starterBattery !== 'Connected') return;
    this.starterBattery = 'Disconnected';
    this.emit({ kind: 'ControlChanged', control: 'starterBattery', value: 'Disconnected' });
    this.reevaluateReadiness();
  }

  /** Test/fault-injection hook — never invoked by normal gameplay flow. */
  simulateBatteryDepletion(): void {
    this.starterBattery = 'Depleted';
    this.emit({ kind: 'ControlChanged', control: 'starterBattery', value: 'Depleted' });
    this.reevaluateReadiness();
  }

  releaseEmergencyStop(): void {
    if (this.emergencyStop === 'Released') return;
    this.emergencyStop = 'Released';
    this.emit({ kind: 'ControlChanged', control: 'emergencyStop', value: 'Released' });
    this.reevaluateReadiness();
  }

  /** Engaging the e-stop while running forces an immediate fault/stop. */
  engageEmergencyStop(): void {
    if (this.emergencyStop === 'Engaged') return;
    this.emergencyStop = 'Engaged';
    this.emit({ kind: 'ControlChanged', control: 'emergencyStop', value: 'Engaged' });
    if (this.state === 'RunningUnstable' || this.state === 'Running') {
      this.beginStop();
    } else if (this.state === 'Cranking') {
      this.fault('EMERGENCY STOP ENGAGED DURING CRANK');
    }
    this.reevaluateReadiness();
  }

  setSelectorManual(): void {
    if (this.selector === 'Manual') return;
    this.selector = 'Manual';
    this.emit({ kind: 'ControlChanged', control: 'selector', value: 'Manual' });
    this.reevaluateReadiness();
  }

  setSelectorOff(): void {
    if (this.selector === 'Off') return;
    this.selector = 'Off';
    this.emit({ kind: 'ControlChanged', control: 'selector', value: 'Off' });
    this.reevaluateReadiness();
  }

  setSelectorAutomatic(): void {
    if (this.selector === 'Automatic') return;
    this.selector = 'Automatic';
    this.emit({ kind: 'ControlChanged', control: 'selector', value: 'Automatic' });
    this.reevaluateReadiness();
  }

  /**
   * Called once the starter hold interaction completes (HoldInteraction
   * framework). Returns a user-facing rejection reason on failure, or null
   * on success. Fully synchronous — "Cranking" is observable via the
   * GeneratorCranking event even though it resolves within the same call.
   */
  attemptStart(): string | null {
    if (this.state !== 'ReadyToStart') {
      return this.readiness.blockingReason ?? 'GENERATOR NOT READY';
    }
    const cranking = tryTransitionGeneratorState(this.state, 'Cranking');
    if (cranking === null) return 'GENERATOR NOT READY';
    this.state = cranking;
    this.emit({ kind: 'GeneratorCranking' });

    if (this.starterBattery === 'Depleted') {
      this.fault('STARTER BATTERY DEPLETED');
      return 'STARTER BATTERY DEPLETED';
    }

    // Crank succeeds whenever readiness holds — no random failure chance
    // (explicitly out of scope: no real electrical simulation).
    this.warmUpElapsed = 0;
    this.setState('RunningUnstable');
    this.emit({ kind: 'GeneratorStarted' });
    return null;
  }

  /** Manual stop: safe shutdown from Running/RunningUnstable. */
  stop(): void {
    if (this.state === 'RunningUnstable' || this.state === 'Running') {
      this.beginStop();
    }
  }

  /** Only permitted once the generator has settled into Running. */
  closeMainBreaker(): string | null {
    if (this.state !== 'Running') {
      return 'MAIN BREAKER LOCKED — GENERATOR UNSTABLE';
    }
    if (this.mainBreaker === 'Closed') return null;
    this.mainBreaker = 'Closed';
    this.emit({ kind: 'MainBreakerClosed' });
    return null;
  }

  openMainBreaker(): void {
    if (this.mainBreaker === 'Open') return;
    this.mainBreaker = 'Open';
    this.emit({ kind: 'MainBreakerOpened' });
  }

  /**
   * Scoped timer tick — call every frame from a single Babylon-facing
   * adapter (see GeneratorInteractionTargets). Accumulates delta seconds;
   * has no timer handles of its own, so it "disposes" simply by no longer
   * being ticked once the adapter's observer is removed.
   */
  update(deltaSeconds: number): void {
    if (this.state === 'RunningUnstable') {
      this.warmUpElapsed += deltaSeconds;
      if (this.warmUpElapsed >= this.definition.warmUpSeconds) {
        this.setState('Running');
        this.emit({ kind: 'GeneratorStable' });
      }
    } else if (this.state === 'Stopping') {
      this.stopElapsed += deltaSeconds;
      if (this.stopElapsed >= this.definition.stopDownSeconds) {
        this.openMainBreaker();
        this.setState('Offline'); // emits GeneratorStopped
        this.setState('InspectionRequired');
        this.setState('NotReady');
        this.reevaluateReadiness();
      }
    }
  }

  /** Full reset to factory defaults (dev "full reset" action only). */
  reset(): void {
    this.state = 'Offline';
    this.fuelValve = 'Closed';
    this.starterBattery = 'Disconnected';
    this.emergencyStop = 'Engaged';
    this.selector = 'Off';
    this.mainBreaker = 'Open';
    this.inspected = false;
    this.warmUpElapsed = 0;
    this.stopElapsed = 0;
  }

  /** Restore from a preserved runtime snapshot (checkpoint/OOB path — never called; state persists naturally). */
  restoreFrom(snapshot: GeneratorControllerSnapshot): void {
    this.state = snapshot.state;
    this.fuelValve = snapshot.fuelValve;
    this.starterBattery = snapshot.starterBattery;
    this.emergencyStop = snapshot.emergencyStop;
    this.selector = snapshot.selector;
    this.mainBreaker = snapshot.mainBreaker;
    this.inspected = snapshot.inspected;
  }

  subscribe(listener: GeneratorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
  }

  // ----- private -----------------------------------------------------------

  private beginStop(): void {
    this.stopElapsed = 0;
    this.setState('Stopping');
  }

  private fault(reason: string): void {
    this.setState('Fault');
    this.emit({ kind: 'GeneratorFaulted', reason });
  }

  private reevaluateReadiness(): void {
    if (this.state !== 'NotReady' && this.state !== 'ReadyToStart') return;
    const ready = this.readiness.ready;
    if (ready && this.state === 'NotReady') {
      this.setState('ReadyToStart');
      this.emit({ kind: 'GeneratorReady' });
    } else if (!ready && this.state === 'ReadyToStart') {
      this.setState('NotReady');
      this.emit({ kind: 'GeneratorNotReady' });
    }
  }

  private setState(target: GeneratorState): void {
    const next = tryTransitionGeneratorState(this.state, target);
    if (next === null) return;
    this.state = next;
    this.emit({ kind: this.eventKindForState(next), state: next });
  }

  private eventKindForState(state: GeneratorState): GeneratorEventKind {
    switch (state) {
      case 'InspectionRequired':
        return 'GeneratorInspected';
      case 'NotReady':
        return 'GeneratorNotReady';
      case 'ReadyToStart':
        return 'GeneratorReady';
      case 'Cranking':
        return 'GeneratorCranking';
      case 'RunningUnstable':
        return 'GeneratorStarted';
      case 'Running':
        return 'GeneratorStable';
      case 'Stopping':
      case 'Offline':
        return 'GeneratorStopped';
      case 'Fault':
        return 'GeneratorFaulted';
    }
  }

  private emit(event: GeneratorEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow.
      }
    }
  }
}
