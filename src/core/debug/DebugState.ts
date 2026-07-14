/**
 * The values the debug overlay renders each refresh tick. Assembled on
 * demand by GameApplication from the engine, stores and input manager —
 * never stored anywhere permanently.
 */
export interface DebugState {
  readonly fps: number;
  readonly lifecycle: string;
  readonly activeScene: string;
  readonly renderingBackend: string;
  readonly renderWidth: number;
  readonly renderHeight: number;
  readonly hardwareScalingLevel: number;
  readonly physicsStatus: string;
  readonly meshCount: number;
  readonly activeCameraName: string;
  readonly pointerLocked: boolean;
  readonly pressedKeys: readonly string[];
  readonly buildMode: string;
}

export type DebugStateProvider = () => DebugState;
