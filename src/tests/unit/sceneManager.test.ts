import { describe, expect, it, vi } from 'vitest';
import { ErrorReporter } from '../../core/errors/ErrorReporter';
import { GameError } from '../../core/errors/GameError';
import { SceneManager } from '../../core/scenes/SceneManager';
import type { ManagedSceneDefinition } from '../../core/scenes/SceneDefinition';
import type { SceneId } from '../../core/scenes/SceneId';

interface StubHandle {
  label: string;
  disposed: boolean;
  dispose(): void;
}

type StubContext = Record<string, never>;

function makeReporter(): ErrorReporter {
  return new ErrorReporter({ mode: 'test', isDevelopment: false, isProduction: false });
}

function makeDefinition(
  id: SceneId,
  options: { failWith?: Error; delayMs?: number } = {},
): { definition: ManagedSceneDefinition<StubHandle, StubContext>; handles: StubHandle[] } {
  const handles: StubHandle[] = [];
  const definition: ManagedSceneDefinition<StubHandle, StubContext> = {
    id,
    async create(): Promise<StubHandle> {
      if (options.delayMs !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
      if (options.failWith !== undefined) {
        throw options.failWith;
      }
      const handle: StubHandle = {
        label: `${id}-${handles.length}`,
        disposed: false,
        dispose(): void {
          this.disposed = true;
        },
      };
      handles.push(handle);
      return handle;
    },
  };
  return { definition, handles };
}

describe('SceneManager', () => {
  it('registers and loads a scene', async () => {
    const manager = new SceneManager<StubHandle, StubContext>(makeReporter());
    const { definition } = makeDefinition('development');
    manager.register(definition);

    const handle = await manager.load('development', {});
    expect(handle.label).toBe('development-0');
    expect(manager.currentSceneId).toBe('development');
    expect(manager.isTransitioning).toBe(false);
  });

  it('rejects duplicate registration', () => {
    const manager = new SceneManager<StubHandle, StubContext>(makeReporter());
    const { definition } = makeDefinition('development');
    manager.register(definition);
    expect(() => manager.register(definition)).toThrow(/already registered/);
  });

  it('rejects unknown scene ids with a scene-create GameError', async () => {
    const manager = new SceneManager<StubHandle, StubContext>(makeReporter());
    // Cast: intentionally probing an id outside the registered set.
    const unknownId = 'no-such-scene' as SceneId;
    await expect(manager.load(unknownId, {})).rejects.toMatchObject({
      name: 'GameError',
      kind: 'scene-create',
    });
  });

  it('disposes the previous scene when loading the next', async () => {
    const manager = new SceneManager<StubHandle, StubContext>(makeReporter());
    const { definition, handles } = makeDefinition('development');
    manager.register(definition);

    await manager.load('development', {});
    await manager.load('development', {});

    expect(handles).toHaveLength(2);
    expect(handles[0]?.disposed).toBe(true);
    expect(handles[1]?.disposed).toBe(false);
  });

  it('prevents overlapping transitions', async () => {
    const manager = new SceneManager<StubHandle, StubContext>(makeReporter());
    const { definition } = makeDefinition('development', { delayMs: 20 });
    manager.register(definition);

    const first = manager.load('development', {});
    await expect(manager.load('development', {})).rejects.toThrow(/transition is in progress/);
    await expect(first).resolves.toBeDefined();
  });

  it('wraps creation failures and resets transition state', async () => {
    const manager = new SceneManager<StubHandle, StubContext>(makeReporter());
    const { definition } = makeDefinition('development', {
      failWith: new Error('renderer exploded'),
    });
    manager.register(definition);

    await expect(manager.load('development', {})).rejects.toBeInstanceOf(GameError);
    expect(manager.isTransitioning).toBe(false);
    expect(manager.currentSceneId).toBeNull();
  });

  it('notifies observers of transition state changes', async () => {
    const events: Array<[SceneId | null, boolean]> = [];
    const manager = new SceneManager<StubHandle, StubContext>(makeReporter(), {
      onStateChange: (id, transitioning) => events.push([id, transitioning]),
    });
    const { definition } = makeDefinition('development');
    manager.register(definition);

    await manager.load('development', {});
    expect(events).toEqual([
      [null, true],
      ['development', false],
    ]);
  });

  it('dispose releases the active scene', async () => {
    const manager = new SceneManager<StubHandle, StubContext>(makeReporter());
    const { definition, handles } = makeDefinition('development');
    manager.register(definition);
    await manager.load('development', {});

    manager.dispose();
    expect(handles[0]?.disposed).toBe(true);
    expect(manager.currentSceneId).toBeNull();
  });

  it('reports load failures to the error reporter', async () => {
    const reporter = makeReporter();
    const spy = vi.spyOn(reporter, 'reportRecoverable');
    const manager = new SceneManager<StubHandle, StubContext>(reporter);
    const { definition } = makeDefinition('development', { failWith: new Error('boom') });
    manager.register(definition);

    await expect(manager.load('development', {})).rejects.toBeInstanceOf(GameError);
    expect(spy).toHaveBeenCalledOnce();
  });
});
