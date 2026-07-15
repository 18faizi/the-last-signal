/**
 * Abstract input actions and their default key bindings.
 *
 * The mapping layer exists so gameplay binds to actions instead of hardcoding
 * physical keys into scene logic. Milestone 0.2 adds the first-person
 * movement actions consumed by the player controller's intent layer.
 */
export enum InputAction {
  MoveForward = 'move-forward',
  MoveBackward = 'move-backward',
  MoveLeft = 'move-left',
  MoveRight = 'move-right',
  Sprint = 'sprint',
  Crouch = 'crouch',
  Jump = 'jump',
  Interact = 'interact',
  ResetPlayer = 'reset-player',
  ToggleDebugOverlay = 'toggle-debug-overlay',
  ToggleDebugVisualization = 'toggle-debug-visualization',
  ToggleInteractionRayDebug = 'toggle-interaction-ray-debug',
  ToggleDoorDebug = 'toggle-door-debug',
  ToggleInventory = 'toggle-inventory',
}

/** Maps KeyboardEvent.code values to actions. */
export type InputBindings = Readonly<Record<string, InputAction>>;

export const DEFAULT_BINDINGS: InputBindings = {
  KeyW: InputAction.MoveForward,
  KeyS: InputAction.MoveBackward,
  KeyA: InputAction.MoveLeft,
  KeyD: InputAction.MoveRight,
  ShiftLeft: InputAction.Sprint,
  ShiftRight: InputAction.Sprint,
  ControlLeft: InputAction.Crouch,
  KeyC: InputAction.Crouch,
  Space: InputAction.Jump,
  KeyE: InputAction.Interact,
  KeyR: InputAction.ResetPlayer,
  Backquote: InputAction.ToggleDebugOverlay,
  F3: InputAction.ToggleDebugOverlay,
  F4: InputAction.ToggleDebugVisualization,
  // F5 is browser refresh; F6 is the first safe function key after it.
  F6: InputAction.ToggleInteractionRayDebug,
  F7: InputAction.ToggleDoorDebug,
  Tab: InputAction.ToggleInventory,
};

/** Human-readable key label for prompts, e.g. 'KeyE' → 'E'. */
export function keyLabelForAction(bindings: InputBindings, action: InputAction): string {
  const code = codesForAction(bindings, action)[0] ?? '';
  return code.startsWith('Key') ? code.slice(3) : code;
}

export function actionForCode(bindings: InputBindings, code: string): InputAction | undefined {
  return bindings[code];
}

/** All key codes bound to the given action. */
export function codesForAction(bindings: InputBindings, action: InputAction): readonly string[] {
  return Object.keys(bindings).filter((code) => bindings[code] === action);
}

/** Whether any key bound to the action is in the pressed set. */
export function isActionPressed(
  bindings: InputBindings,
  pressed: ReadonlySet<string>,
  action: InputAction,
): boolean {
  for (const code of Object.keys(bindings)) {
    if (bindings[code] === action && pressed.has(code)) {
      return true;
    }
  }
  return false;
}
