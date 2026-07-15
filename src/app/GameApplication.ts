import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { AssetManager } from '../core/assets/AssetManager';
import { ASSET_MANIFEST } from '../core/assets/AssetManifest';
import { AudioManager } from '../core/audio/AudioManager';
import { DebugOverlay } from '../core/debug/DebugOverlay';
import type { DebugState } from '../core/debug/DebugState';
import { EngineFactory } from '../core/engine/EngineFactory';
import type { EngineCapabilities } from '../core/engine/EngineCapabilities';
import { GameError } from '../core/errors/GameError';
import { InputAction } from '../core/input/InputAction';
import { InputManager } from '../core/input/InputManager';
import { PhysicsService } from '../core/physics/PhysicsService';
import { SceneManager } from '../core/scenes/SceneManager';
import type { SceneCreationContext, SceneHandle } from '../core/scenes/SceneDefinition';
import { developmentSceneDefinition } from '../scenes/development/DevelopmentScene';
import { movementTestSceneDefinition } from '../scenes/movement-test/MovementTestScene';
import { interactionTestSceneDefinition } from '../scenes/interaction-test/InteractionTestScene';
import { FatalErrorScreen } from '../ui/FatalErrorScreen';
import { LoadingScreen } from '../ui/LoadingScreen';
import type { ApplicationContext } from './ApplicationContext';
import { DisposableBag } from './lifecycle/Disposable';
import { assertTransition, canTransition, type LifecycleState } from './lifecycle/LifecycleState';

/**
 * Orchestrates the application: owns the lifecycle state machine, boots
 * every service in order, runs the single render loop, and tears everything
 * down deterministically on stop or failure.
 */
export class GameApplication {
  private readonly context: ApplicationContext;
  private readonly cleanup = new DisposableBag();

  private lifecycle: LifecycleState = 'created';
  private engine: AbstractEngine | null = null;
  private capabilities: EngineCapabilities | null = null;
  private sceneManager: SceneManager<SceneHandle, SceneCreationContext> | null = null;
  private inputManager: InputManager | null = null;
  private debugOverlay: DebugOverlay | null = null;
  private renderLoopStarted = false;

  constructor(context: ApplicationContext) {
    this.context = context;
  }

  get lifecycleState(): LifecycleState {
    return this.lifecycle;
  }

  async start(): Promise<void> {
    if (this.lifecycle !== 'created') {
      throw new Error(`start() called in lifecycle state '${this.lifecycle}'`);
    }

    const { dom, environment, gameConfig, performanceConfig, applicationStore, errorReporter } =
      this.context;

    const loadingScreen = new LoadingScreen(dom.loadingRoot, dom.loadingStage, dom.loadingBarFill);
    const fatalScreen = new FatalErrorScreen(environment, {
      root: dom.fatalRoot,
      message: dom.fatalMessage,
      details: dom.fatalDetails,
      reloadButton: dom.fatalReloadButton,
      copyButton: dom.fatalCopyButton,
    });
    errorReporter.onFatal((error) => {
      loadingScreen.dispose();
      fatalScreen.show(error);
    });

    try {
      this.transitionTo('initializing');

      loadingScreen.setStage('Initializing renderer', 0.1);
      const engineFactory = new EngineFactory(environment, performanceConfig);
      const { engine, capabilities } = await engineFactory.createEngine(dom.canvas);
      this.engine = engine;
      this.capabilities = capabilities;
      applicationStore.getState().setRenderingBackend(capabilities.backend);

      loadingScreen.setStage('Loading physics', 0.35);
      applicationStore.getState().setPhysicsStatus('initializing');
      const physics = new PhysicsService(gameConfig.gravity);
      await physics.loadRuntime();

      loadingScreen.setStage('Preparing systems', 0.55);
      const inputManager = new InputManager(dom.canvas);
      this.inputManager = inputManager;
      this.cleanup.add(inputManager);

      const audioManager = new AudioManager(gameConfig.audio);
      this.cleanup.add(audioManager);

      const assetManager = new AssetManager(ASSET_MANIFEST, errorReporter);
      this.cleanup.add(assetManager);

      this.sceneManager = new SceneManager<SceneHandle, SceneCreationContext>(errorReporter, {
        onStateChange: (activeSceneId, transitioning) => {
          const state = applicationStore.getState();
          state.setCurrentScene(activeSceneId);
          state.setSceneTransition(transitioning ? 'transitioning' : 'idle');
        },
      });
      this.sceneManager.register(developmentSceneDefinition);
      this.sceneManager.register(movementTestSceneDefinition);
      this.sceneManager.register(interactionTestSceneDefinition);
      this.cleanup.add(this.sceneManager);

      if (environment.isDevelopment) {
        this.setUpDebugOverlay();
      }

      // Keep settings volumes flowing into the audio buses.
      const unsubscribeSettings = this.context.settingsStore.subscribe((settings) => {
        audioManager.setBusVolume('master', settings.masterVolume);
        audioManager.setBusVolume('music', settings.musicVolume);
        audioManager.setBusVolume('effects', settings.effectsVolume);
      });
      this.cleanup.add(unsubscribeSettings);

      loadingScreen.setStage('Loading scene', 0.75);
      await this.sceneManager.load('interaction-test', {
        engine,
        canvas: dom.canvas,
        physics,
        environment,
        input: inputManager,
        settings: this.context.settingsStore,
        errorReporter,
        overlayParent: dom.appRoot,
        onPhysicsReady: () => {
          applicationStore.getState().setPhysicsStatus('ready');
          if (this.capabilities !== null) {
            this.capabilities.physicsReady = true;
          }
        },
      });

      this.transitionTo('ready');
      loadingScreen.setStage('Ready', 1);

      this.startRenderLoop(engine);
      this.attachResizeHandling(engine);

      loadingScreen.hide();
      // The scene owns its development marker text (e.g. milestone label);
      // the application only places whatever the active scene provides.
      const markerText = this.sceneManager?.currentHandle?.markerText;
      dom.readyMarker.textContent = markerText ?? '';
      dom.readyMarker.hidden = markerText === undefined;
      dom.canvas.focus();

      this.transitionTo('running');
    } catch (thrown) {
      this.fail(GameError.wrap('unexpected', thrown, 'Application startup failed'));
    }
  }

  stop(): void {
    if (this.lifecycle === 'stopping' || this.lifecycle === 'stopped') {
      return;
    }
    if (!canTransition(this.lifecycle, 'stopping')) {
      return;
    }
    this.transitionTo('stopping');

    this.engine?.stopRenderLoop();
    this.renderLoopStarted = false;
    this.cleanup.dispose();
    this.debugOverlay = null;
    this.inputManager = null;
    this.sceneManager = null;
    this.engine?.dispose();
    this.engine = null;

    this.transitionTo('stopped');
  }

  private fail(error: GameError): void {
    if (canTransition(this.lifecycle, 'failed')) {
      this.transitionTo('failed');
    }
    this.context.applicationStore.getState().setFatalErrorMessage(error.userMessage);
    this.context.applicationStore
      .getState()
      .setPhysicsStatus(
        error.kind === 'physics-init'
          ? 'failed'
          : this.context.applicationStore.getState().physicsStatus,
      );
    this.engine?.stopRenderLoop();
    this.context.errorReporter.reportFatal(error);
  }

  private transitionTo(next: LifecycleState): void {
    assertTransition(this.lifecycle, next);
    this.lifecycle = next;
    this.context.applicationStore.getState().setLifecycle(next);
  }

  /** The application's single render loop; scenes are looked up per frame. */
  private startRenderLoop(engine: AbstractEngine): void {
    if (this.renderLoopStarted) {
      return;
    }
    this.renderLoopStarted = true;
    engine.runRenderLoop(() => {
      const handle = this.sceneManager?.currentHandle;
      if (handle !== null && handle !== undefined && handle.scene.activeCamera !== null) {
        handle.scene.render();
      }
    });
  }

  private attachResizeHandling(engine: AbstractEngine): void {
    const onResize = (): void => {
      engine.resize();
    };
    window.addEventListener('resize', onResize);
    this.cleanup.add(() => window.removeEventListener('resize', onResize));
  }

  private setUpDebugOverlay(): void {
    const overlay = new DebugOverlay(
      this.context.dom.debugRoot,
      () => this.collectDebugState(),
      this.context.performanceConfig.debugOverlayUpdateIntervalMs,
    );
    this.debugOverlay = overlay;
    this.cleanup.add(overlay);

    if (this.inputManager !== null) {
      const unsubscribe = this.inputManager.onAction((action) => {
        if (action === InputAction.ToggleDebugOverlay) {
          overlay.toggle();
        }
      });
      this.cleanup.add(unsubscribe);
    }
  }

  private collectDebugState(): DebugState {
    const appState = this.context.applicationStore.getState();
    const scene = this.sceneManager?.currentHandle?.scene ?? null;
    // getPressedKeyCodes (not getSnapshot) so the overlay never consumes
    // pointer/wheel deltas intended for gameplay consumers.
    const snapshotKeys = this.inputManager?.getPressedKeyCodes() ?? [];
    return {
      fps: this.engine?.getFps() ?? 0,
      lifecycle: this.lifecycle,
      activeScene: appState.currentSceneId ?? 'none',
      renderingBackend: appState.renderingBackend,
      renderWidth: this.engine?.getRenderWidth() ?? 0,
      renderHeight: this.engine?.getRenderHeight() ?? 0,
      hardwareScalingLevel: this.engine?.getHardwareScalingLevel() ?? 1,
      physicsStatus: appState.physicsStatus,
      meshCount: scene?.meshes.length ?? 0,
      activeCameraName: scene?.activeCamera?.name ?? 'none',
      pointerLocked: document.pointerLockElement !== null,
      pressedKeys: snapshotKeys,
      buildMode: this.context.environment.mode,
      extra: this.sceneManager?.currentHandle?.getDebugFields?.() ?? [],
    };
  }
}
