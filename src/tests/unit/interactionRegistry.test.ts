// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { InteractionRegistry } from '../../game/interaction/InteractionRegistry';
import { AVAILABLE, type InteractionTarget } from '../../game/interaction/InteractionTarget';
import {
  validateInteractionConfig,
  DEFAULT_INTERACTION_CONFIG,
} from '../../game/interaction/InteractionConfig';

/**
 * Registry tests use Babylon's NullEngine — a headless engine with no
 * rendering — so mesh parent/metadata resolution is exercised for real.
 */
function makeScene(): Scene {
  return new Scene(new NullEngine());
}

function makeTarget(
  scene: Scene,
  id: string,
): { target: InteractionTarget; disposeSpy: () => void } {
  const root = CreateBox(`${id}-root`, { size: 1 }, scene);
  const child = CreateBox(`${id}-child`, { size: 0.2 }, scene);
  child.parent = root;
  const disposeSpy = vi.fn();
  return {
    target: {
      id,
      kind: 'immediate',
      meshes: [root],
      getPrompt: () => ({ verb: 'USE', label: id }),
      getAvailability: () => AVAILABLE,
      interact: () => ({ status: 'completed' as const }),
      dispose: disposeSpy,
    },
    disposeSpy,
  };
}

describe('InteractionRegistry', () => {
  it('resolves root and child meshes to the owning target', () => {
    const scene = makeScene();
    const registry = new InteractionRegistry();
    const { target } = makeTarget(scene, 'switch');
    registry.register(target);

    const root = scene.getMeshByName('switch-root');
    const child = scene.getMeshByName('switch-child');
    expect(root).not.toBeNull();
    expect(child).not.toBeNull();
    if (root !== null && child !== null) {
      expect(registry.resolveFromMesh(root)?.id).toBe('switch');
      // Child meshes resolve to the parent target — a decorative knob can
      // never steal focus from its owner.
      expect(registry.resolveFromMesh(child)?.id).toBe('switch');
    }
    scene.dispose();
  });

  it('rejects duplicate ids', () => {
    const scene = makeScene();
    const registry = new InteractionRegistry();
    const { target } = makeTarget(scene, 'a');
    registry.register(target);
    expect(() => registry.register(target)).toThrow(/already registered/);
    scene.dispose();
  });

  it('unregister removes resolution and calls target dispose', () => {
    const scene = makeScene();
    const registry = new InteractionRegistry();
    const { target, disposeSpy } = makeTarget(scene, 'a');
    registry.register(target);
    registry.unregister('a');
    const root = scene.getMeshByName('a-root');
    if (root !== null) {
      expect(registry.resolveFromMesh(root)).toBeUndefined();
    }
    expect(disposeSpy).toHaveBeenCalledOnce();
    expect(registry.size).toBe(0);
    scene.dispose();
  });

  it('returns undefined for unrelated meshes', () => {
    const scene = makeScene();
    const registry = new InteractionRegistry();
    const plain = CreateBox('plain', { size: 1 }, scene);
    expect(registry.resolveFromMesh(plain)).toBeUndefined();
    scene.dispose();
  });
});

describe('interaction config validation', () => {
  it('accepts the shipped config', () => {
    expect(validateInteractionConfig(DEFAULT_INTERACTION_CONFIG)).toEqual([]);
  });

  it('rejects a probe shorter than the interaction distance', () => {
    expect(
      validateInteractionConfig({ ...DEFAULT_INTERACTION_CONFIG, probeDistance: 1 }),
    ).not.toEqual([]);
  });
});
