import { describe, expect, it, vi } from 'vitest';
import { AssetManager } from '../../core/assets/AssetManager';
import { validateManifest } from '../../core/assets/AssetManifest';
import type { AssetDescriptor, AssetKind } from '../../core/assets/AssetTypes';
import { ErrorReporter } from '../../core/errors/ErrorReporter';
import { GameError } from '../../core/errors/GameError';

function makeReporter(): ErrorReporter {
  return new ErrorReporter({ mode: 'test', isDevelopment: false, isProduction: false });
}

const MANIFEST: readonly AssetDescriptor[] = [
  { id: 'test-json', kind: 'json', url: '/data/test.json' },
  { id: 'test-texture', kind: 'texture', url: '/textures/test.png' },
];

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    expect(validateManifest(MANIFEST)).toEqual([]);
  });

  it('accepts the empty milestone manifest', () => {
    expect(validateManifest([])).toEqual([]);
  });

  it('rejects duplicate ids', () => {
    const problems = validateManifest([
      { id: 'a', kind: 'json', url: '/a.json' },
      { id: 'a', kind: 'json', url: '/b.json' },
    ]);
    expect(problems.some((p) => p.includes('Duplicate asset id'))).toBe(true);
  });

  it('rejects empty ids, urls, and unknown kinds', () => {
    const problems = validateManifest([
      { id: '', kind: 'json', url: '/a.json' },
      { id: 'b', kind: 'nonsense' as AssetKind, url: '/b.bin' },
      { id: 'c', kind: 'json', url: ' ' },
    ]);
    expect(problems).toHaveLength(3);
  });
});

describe('AssetManager', () => {
  it('loads through the injected loader and caches the result', async () => {
    const loader = vi.fn().mockResolvedValue({ hello: 'world' });
    const manager = new AssetManager(MANIFEST, makeReporter(), loader);

    const first = await manager.load('test-json');
    const second = await manager.load('test-json');
    expect(first).toEqual({ hello: 'world' });
    expect(second).toBe(first);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(manager.getStatus('test-json')).toBe('loaded');
  });

  it('deduplicates concurrent loads of the same asset', async () => {
    let resolveLoad: (value: unknown) => void = () => undefined;
    const loader = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const manager = new AssetManager(MANIFEST, makeReporter(), loader);

    const a = manager.load('test-json');
    const b = manager.load('test-json');
    resolveLoad('payload');
    await expect(a).resolves.toBe('payload');
    await expect(b).resolves.toBe('payload');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown asset ids', async () => {
    const manager = new AssetManager(MANIFEST, makeReporter(), vi.fn());
    await expect(manager.load('missing')).rejects.toBeInstanceOf(GameError);
  });

  it('marks failed loads and wraps the error', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('404'));
    const manager = new AssetManager(MANIFEST, makeReporter(), loader);

    await expect(manager.load('test-json')).rejects.toMatchObject({ kind: 'asset-load' });
    expect(manager.getStatus('test-json')).toBe('failed');
  });

  it('reports progress as assets finish', async () => {
    const loader = vi.fn().mockResolvedValue('data');
    const manager = new AssetManager(MANIFEST, makeReporter(), loader);
    const fractions: number[] = [];
    manager.onProgress((progress) => fractions.push(progress.fraction));

    await manager.loadAll();
    expect(fractions).toContain(1);
    expect(manager.getProgress()).toEqual({ loaded: 2, total: 2, fraction: 1 });
  });

  it('reports fraction 1 for an empty manifest', () => {
    const manager = new AssetManager([], makeReporter(), vi.fn());
    expect(manager.getProgress().fraction).toBe(1);
  });
});
