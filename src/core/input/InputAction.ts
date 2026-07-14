/**
 * Abstract input actions and their default key bindings.
 *
 * Milestone 0.1 only *tracks* raw input; nothing consumes movement actions
 * yet. The mapping layer exists now so later milestones bind gameplay to
 * actions instead of hardcoding physical keys into scene logic.
 */
export enum InputAction {
  MoveForward = 'move-forward',
  MoveBackward = 'move-backward',
  MoveLeft = 'move-left',
  MoveRight = 'move-right',
  Interact = 'interact',
  ToggleDebugOverlay = 'toggle-debug-overlay',
}

/** Maps KeyboardEvent.code values to actions. */
export type InputBindings = Readonly<Record<string, InputAction>>;

export const DEFAULT_BINDINGS: InputBindings = {
  KeyW: InputAction.MoveForward,
  KeyS: InputAction.MoveBackward,
  KeyA: InputAction.MoveLeft,
  KeyD: InputAction.MoveRight,
  KeyE: InputAction.Interact,
  Backquote: InputAction.ToggleDebugOverlay,
  F3: InputAction.ToggleDebugOverlay,
};

export function actionForCode(bindings: InputBindings, code: string): InputAction | undefined {
  return bindings[code];
}
