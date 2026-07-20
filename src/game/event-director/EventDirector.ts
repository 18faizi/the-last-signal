/**
 * Event director (Milestone 0.9): condition-driven authored-event engine.
 *
 * Evaluation model: the scene bindings SUBSCRIBE to the relevant typed
 * events (power, zone, door, receiver, threat, runtime-state) and call
 * evaluate() when something meaningful changes — there is no per-frame full
 * condition rescan. update(dt) only advances pending delays and the
 * director clock backing 'time-since-event' conditions (and re-evaluates
 * when a delay elapses or a time-since threshold could newly hold), ticked
 * from the scene's existing per-frame observer at trivial cost.
 *
 * Pure TS: conditions read through EventConditionContext callbacks, actions
 * run through the EventActionExecutor — both implemented scene-side.
 */
import { evaluateAllConditions, type EventConditionContext } from './EventCondition';
import type { EventActionExecutor, EventAction } from './EventAction';
import type { EventDefinition } from './EventDefinition';
import { runEventActions } from './EventSequence';
import type { EventRuntimeState } from './EventState';

interface EventRuntime {
  readonly definition: EventDefinition;
  state: EventRuntimeState;
  delayRemaining: number;
  firedAtClock: number | null;
  fireCount: number;
}

export interface EventDirectorSnapshot {
  readonly clockSeconds: number;
  readonly events: ReadonlyArray<{
    id: string;
    state: EventRuntimeState;
    fireCount: number;
    delayRemaining: number;
  }>;
  readonly firedEventIds: readonly string[];
}

export type EventDirectorListener = (eventId: string) => void;

export class EventDirector {
  private readonly events = new Map<string, EventRuntime>();
  private readonly listeners = new Set<EventDirectorListener>();
  private clock = 0;
  private hasTimeConditions = false;
  private timeEvalAccumulator = 0;

  constructor(
    private readonly ctx: EventConditionContext,
    private readonly executor: EventActionExecutor,
    private readonly onActionError?: (eventId: string, action: EventAction, error: unknown) => void,
  ) {}

  register(definition: EventDefinition): void {
    if (this.events.has(definition.id)) {
      throw new Error(`EventDirector: duplicate event id "${definition.id}"`);
    }
    this.events.set(definition.id, {
      definition,
      state: 'Idle',
      delayRemaining: 0,
      firedAtClock: null,
      fireCount: 0,
    });
    if (definition.conditions.some((c) => c.kind === 'time-since-event')) {
      this.hasTimeConditions = true;
    }
  }

  // ----- read --------------------------------------------------------------

  getState(eventId: string): EventRuntimeState | undefined {
    return this.events.get(eventId)?.state;
  }

  hasFired(eventId: string): boolean {
    return (this.events.get(eventId)?.fireCount ?? 0) > 0;
  }

  /** Seconds since the event last fired, or null when it never fired. */
  secondsSinceFired(eventId: string): number | null {
    const runtime = this.events.get(eventId);
    if (runtime === undefined || runtime.firedAtClock === null) return null;
    return this.clock - runtime.firedAtClock;
  }

  getSnapshot(): EventDirectorSnapshot {
    return {
      clockSeconds: this.clock,
      events: [...this.events.values()].map((r) => ({
        id: r.definition.id,
        state: r.state,
        fireCount: r.fireCount,
        delayRemaining: r.delayRemaining,
      })),
      firedEventIds: [...this.events.values()]
        .filter((r) => r.fireCount > 0)
        .map((r) => r.definition.id),
    };
  }

  subscribe(listener: EventDirectorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ----- evaluation --------------------------------------------------------

  /**
   * Re-evaluates every non-terminal event against the current context.
   * Called by scene bindings on meaningful typed events. The registered set
   * is authored and small (single digits), so a full pass is cheaper than
   * maintaining a per-signal index.
   */
  evaluate(): void {
    for (const runtime of this.events.values()) {
      this.evaluateOne(runtime);
    }
  }

  /** Advances the clock + pending delays; fires events whose delay elapsed. */
  update(deltaSeconds: number): void {
    const dt = Math.max(deltaSeconds, 0);
    this.clock += dt;
    let needsEvaluate = false;
    for (const runtime of this.events.values()) {
      if (runtime.state === 'PendingDelay') {
        runtime.delayRemaining -= dt;
        if (runtime.delayRemaining <= 0) {
          this.fire(runtime);
          needsEvaluate = true;
        }
      }
    }
    // 'time-since-event' conditions can newly hold purely through the
    // passage of time — re-check them without any external signal, at a
    // 0.25 s cadence (never a per-frame full rescan).
    this.timeEvalAccumulator += dt;
    if (needsEvaluate || (this.hasTimeConditions && this.timeEvalAccumulator >= 0.25)) {
      this.timeEvalAccumulator = 0;
      this.evaluate();
    }
  }

  /** Cancels an event permanently (until reset): Idle/Pending -> Cancelled. */
  cancel(eventId: string): boolean {
    const runtime = this.events.get(eventId);
    if (runtime === undefined) return false;
    if (runtime.state === 'Cancelled') return true;
    runtime.state = 'Cancelled';
    runtime.delayRemaining = 0;
    return true;
  }

  /** Full reset (dev "full reset" action only): all Idle, clock zeroed. */
  reset(): void {
    for (const runtime of this.events.values()) {
      runtime.state = 'Idle';
      runtime.delayRemaining = 0;
      runtime.firedAtClock = null;
      runtime.fireCount = 0;
    }
    this.clock = 0;
  }

  dispose(): void {
    this.events.clear();
    this.listeners.clear();
  }

  // ----- private -----------------------------------------------------------

  private dependenciesMet(runtime: EventRuntime): boolean {
    for (const dep of runtime.definition.dependencies) {
      if (!this.hasFired(dep)) return false;
    }
    return true;
  }

  private evaluateOne(runtime: EventRuntime): void {
    if (runtime.state === 'Cancelled' || runtime.state === 'PendingDelay') return;
    if (runtime.state === 'Fired') {
      if (runtime.definition.oneShot) return;
      // Repeatable re-arm: conditions must be observed FALSE once between fires.
      if (!evaluateAllConditions(runtime.definition.conditions, this.ctx)) {
        runtime.state = 'Idle';
      }
      return;
    }
    // Idle:
    if (!this.dependenciesMet(runtime)) return;
    if (!evaluateAllConditions(runtime.definition.conditions, this.ctx)) return;
    if (runtime.definition.delaySeconds > 0) {
      runtime.state = 'PendingDelay';
      runtime.delayRemaining = runtime.definition.delaySeconds;
    } else {
      this.fire(runtime);
    }
  }

  private fire(runtime: EventRuntime): void {
    runtime.state = 'Fired';
    runtime.delayRemaining = 0;
    runtime.firedAtClock = this.clock;
    runtime.fireCount += 1;
    runEventActions(
      runtime.definition.id,
      runtime.definition.actions,
      this.executor,
      this.onActionError,
    );
    for (const listener of this.listeners) {
      try {
        listener(runtime.definition.id);
      } catch {
        // Swallow.
      }
    }
  }
}
