/**
 * Immutable view of the raw input state at a point in time.
 *
 * Consumers query this via InputManager.getSnapshot(); they never receive a
 * reference to the manager's mutable internals.
 */
export interface PointerState {
  readonly x: number;
  readonly y: number;
  /** Movement since the previous snapshot was taken. */
  readonly deltaX: number;
  readonly deltaY: number;
  readonly buttons: ReadonlySet<number>;
}

export interface InputSnapshot {
  readonly pressedKeys: ReadonlySet<string>;
  readonly pointer: PointerState;
  /** Accumulated wheel delta since the previous snapshot. */
  readonly wheelDelta: number;
  readonly windowFocused: boolean;
}
