import type { Disposable } from '../../app/lifecycle/Disposable';
import { GameError } from '../errors/GameError';
import type { ErrorReporter } from '../errors/ErrorReporter';
import type { AssetDescriptor, AssetLoadStatus, AssetProgress } from './AssetTypes';

export type AssetLoader = (descriptor: AssetDescriptor) => Promise<unknown>;
export type ProgressListener = (progress: AssetProgress) => void;

/** Fetch-based loader used for JSON assets; other kinds arrive in later milestones. */
async function defaultLoader(descriptor: AssetDescriptor): Promise<unknown> {
  const response = await fetch(descriptor.url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${descriptor.url}`);
  }
  if (descriptor.kind === 'json') {
    return response.json();
  }
  return response.arrayBuffer();
}

/**
 * Loads, caches and tracks assets declared in the manifest.
 *
 * Duplicate-load prevention: a second `load` for an id returns the same
 * in-flight promise rather than fetching twice. Loaded results are cached
 * until `dispose`.
 */
export class AssetManager implements Disposable {
  private readonly descriptors = new Map<string, AssetDescriptor>();
  private readonly cache = new Map<string, unknown>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly statuses = new Map<string, AssetLoadStatus>();
  private readonly errorReporter: ErrorReporter;
  private readonly loader: AssetLoader;
  private progressListener: ProgressListener | undefined;

  constructor(
    manifest: readonly AssetDescriptor[],
    errorReporter: ErrorReporter,
    loader: AssetLoader = defaultLoader,
  ) {
    this.errorReporter = errorReporter;
    this.loader = loader;
    for (const descriptor of manifest) {
      this.descriptors.set(descriptor.id, descriptor);
      this.statuses.set(descriptor.id, 'idle');
    }
  }

  onProgress(listener: ProgressListener): void {
    this.progressListener = listener;
  }

  getStatus(assetId: string): AssetLoadStatus {
    return this.statuses.get(assetId) ?? 'idle';
  }

  getProgress(): AssetProgress {
    const total = this.descriptors.size;
    let loaded = 0;
    for (const status of this.statuses.values()) {
      if (status === 'loaded') {
        loaded += 1;
      }
    }
    return { loaded, total, fraction: total === 0 ? 1 : loaded / total };
  }

  async load(assetId: string): Promise<unknown> {
    const cached = this.cache.get(assetId);
    if (cached !== undefined) {
      return cached;
    }
    const pending = this.inFlight.get(assetId);
    if (pending !== undefined) {
      return pending;
    }

    const descriptor = this.descriptors.get(assetId);
    if (descriptor === undefined) {
      const error = new GameError('asset-load', `Unknown asset id: '${assetId}'`);
      this.errorReporter.reportRecoverable(error);
      throw error;
    }

    this.statuses.set(assetId, 'loading');
    const promise = this.loader(descriptor)
      .then((result) => {
        this.cache.set(assetId, result);
        this.statuses.set(assetId, 'loaded');
        this.inFlight.delete(assetId);
        this.progressListener?.(this.getProgress());
        return result;
      })
      .catch((thrown: unknown) => {
        this.statuses.set(assetId, 'failed');
        this.inFlight.delete(assetId);
        const error = GameError.wrap('asset-load', thrown, `Failed to load asset '${assetId}'`);
        this.errorReporter.reportRecoverable(error);
        throw error;
      });
    this.inFlight.set(assetId, promise);
    return promise;
  }

  /** Loads every manifest entry; resolves when all succeed. */
  async loadAll(): Promise<void> {
    await Promise.all([...this.descriptors.keys()].map((id) => this.load(id)));
  }

  dispose(): void {
    // Future asset kinds (GPU textures, audio buffers) will need per-kind
    // release logic here; plain data only needs dropping references.
    this.cache.clear();
    this.inFlight.clear();
    for (const id of this.statuses.keys()) {
      this.statuses.set(id, 'idle');
    }
    this.progressListener = undefined;
  }
}
