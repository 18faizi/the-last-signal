import { createStore, type StoreApi } from 'zustand/vanilla';
import type { LifecycleState } from '../app/lifecycle/LifecycleState';
import type { SceneId } from '../core/scenes/SceneId';

/**
 * High-level application state.
 *
 * Deliberately excludes anything per-frame or engine-owned: no Babylon
 * objects, no pointer deltas, no mesh transforms. Those stay inside the
 * services that own them; this store is for coarse state that UI and debug
 * tooling observe.
 */
export type RenderingBackend = 'webgpu' | 'webgl' | 'unknown';
export type PhysicsStatus = 'uninitialized' | 'initializing' | 'ready' | 'failed';
export type SceneTransitionStatus = 'idle' | 'transitioning';

export interface ApplicationState {
  lifecycle: LifecycleState;
  currentSceneId: SceneId | null;
  sceneTransition: SceneTransitionStatus;
  renderingBackend: RenderingBackend;
  physicsStatus: PhysicsStatus;
  fatalErrorMessage: string | null;
  developmentMode: boolean;

  setLifecycle(state: LifecycleState): void;
  setCurrentScene(sceneId: SceneId | null): void;
  setSceneTransition(status: SceneTransitionStatus): void;
  setRenderingBackend(backend: RenderingBackend): void;
  setPhysicsStatus(status: PhysicsStatus): void;
  setFatalErrorMessage(message: string | null): void;
}

export type ApplicationStore = StoreApi<ApplicationState>;

export function createApplicationStore(options: { developmentMode: boolean }): ApplicationStore {
  return createStore<ApplicationState>()((set) => ({
    lifecycle: 'created',
    currentSceneId: null,
    sceneTransition: 'idle',
    renderingBackend: 'unknown',
    physicsStatus: 'uninitialized',
    fatalErrorMessage: null,
    developmentMode: options.developmentMode,

    setLifecycle: (lifecycle) => set({ lifecycle }),
    setCurrentScene: (currentSceneId) => set({ currentSceneId }),
    setSceneTransition: (sceneTransition) => set({ sceneTransition }),
    setRenderingBackend: (renderingBackend) => set({ renderingBackend }),
    setPhysicsStatus: (physicsStatus) => set({ physicsStatus }),
    setFatalErrorMessage: (fatalErrorMessage) => set({ fatalErrorMessage }),
  }));
}
