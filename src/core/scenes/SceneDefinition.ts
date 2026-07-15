import type { Scene } from '@babylonjs/core/scene';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import type { Disposable } from '../../app/lifecycle/Disposable';
import type { EnvironmentInfo } from '../../config/environment';
import type { SettingsStore } from '../../state/settingsStore';
import type { ErrorReporter } from '../errors/ErrorReporter';
import type { InputManager } from '../input/InputManager';
import type { PhysicsService } from '../physics/PhysicsService';
import type { SceneId } from './SceneId';

/**
 * A live, created scene. `dispose` must release the Babylon scene and any
 * listeners/observers the scene registered.
 */
export interface SceneHandle extends Disposable {
  readonly scene: Scene;
  /**
   * Development marker text shown bottom-right (e.g. the current milestone).
   * Owned by the scene so milestone strings never live in bootstrap code.
   */
  readonly markerText?: string;
  /**
   * Optional scene-specific rows for the development debug overlay
   * (label/value pairs). Polled on the overlay's refresh timer.
   */
  getDebugFields?(): ReadonlyArray<readonly [string, string]>;
}

/** Everything a scene needs to build itself; passed in explicitly. */
export interface SceneCreationContext {
  readonly engine: AbstractEngine;
  readonly canvas: HTMLCanvasElement;
  readonly physics: PhysicsService;
  readonly environment: EnvironmentInfo;
  readonly input: InputManager;
  readonly settings: SettingsStore;
  readonly errorReporter: ErrorReporter;
  /** Parent element for scene-owned DOM overlays (e.g. pointer-lock prompt). */
  readonly overlayParent: HTMLElement;
  /** Reports physics availability so capability/debug state stays truthful. */
  readonly onPhysicsReady: () => void;
}

/**
 * Generic shape the SceneManager works against. The manager is deliberately
 * unaware of Babylon: it only needs an id, an async factory, and a
 * disposable result, which also makes it unit-testable without a renderer.
 */
export interface ManagedSceneDefinition<THandle extends Disposable, TContext> {
  readonly id: SceneId;
  create(context: TContext): Promise<THandle>;
}

/** Concrete definition type used by the game. */
export type SceneDefinition = ManagedSceneDefinition<SceneHandle, SceneCreationContext>;
