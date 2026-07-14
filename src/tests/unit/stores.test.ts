import { describe, expect, it } from 'vitest';
import { createApplicationStore } from '../../state/applicationStore';
import { clampVolume, createSettingsStore } from '../../state/settingsStore';
import { gameConfig } from '../../config/gameConfig';

describe('applicationStore', () => {
  it('starts with expected defaults', () => {
    const store = createApplicationStore({ developmentMode: true });
    const state = store.getState();
    expect(state.lifecycle).toBe('created');
    expect(state.currentSceneId).toBeNull();
    expect(state.sceneTransition).toBe('idle');
    expect(state.renderingBackend).toBe('unknown');
    expect(state.physicsStatus).toBe('uninitialized');
    expect(state.fatalErrorMessage).toBeNull();
    expect(state.developmentMode).toBe(true);
  });

  it('updates via actions', () => {
    const store = createApplicationStore({ developmentMode: false });
    store.getState().setLifecycle('running');
    store.getState().setCurrentScene('development');
    store.getState().setRenderingBackend('webgl');
    store.getState().setPhysicsStatus('ready');
    store.getState().setFatalErrorMessage('bad');

    const state = store.getState();
    expect(state.lifecycle).toBe('running');
    expect(state.currentSceneId).toBe('development');
    expect(state.renderingBackend).toBe('webgl');
    expect(state.physicsStatus).toBe('ready');
    expect(state.fatalErrorMessage).toBe('bad');
  });

  it('notifies subscribers exactly once per update', () => {
    const store = createApplicationStore({ developmentMode: false });
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    store.getState().setLifecycle('initializing');
    unsubscribe();
    store.getState().setLifecycle('failed');
    expect(calls).toBe(1);
  });
});

describe('settingsStore', () => {
  function makeStore() {
    return createSettingsStore({
      audioDefaults: gameConfig.audio,
      initialGraphicsPreset: 'high',
    });
  }

  it('initializes from configured defaults', () => {
    const state = makeStore().getState();
    expect(state.masterVolume).toBe(gameConfig.audio.masterVolume);
    expect(state.musicVolume).toBe(gameConfig.audio.musicVolume);
    expect(state.effectsVolume).toBe(gameConfig.audio.effectsVolume);
    expect(state.graphicsQuality).toBe('high');
    expect(state.invertYAxis).toBe(false);
  });

  it('clamps volumes to [0, 1]', () => {
    const store = makeStore();
    store.getState().setVolume('masterVolume', 4);
    expect(store.getState().masterVolume).toBe(1);
    store.getState().setVolume('musicVolume', -2);
    expect(store.getState().musicVolume).toBe(0);
    store.getState().setVolume('effectsVolume', Number.NaN);
    expect(store.getState().effectsVolume).toBe(0);
  });

  it('rejects nonsensical mouse sensitivity', () => {
    const store = makeStore();
    store.getState().setMouseSensitivity(-3);
    expect(store.getState().mouseSensitivity).toBe(1);
    store.getState().setMouseSensitivity(2.5);
    expect(store.getState().mouseSensitivity).toBe(2.5);
  });

  it('clampVolume handles non-finite input', () => {
    expect(clampVolume(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampVolume(0.5)).toBe(0.5);
  });
});
