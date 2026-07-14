/** Asset categories the pipeline will eventually support. */
export type AssetKind = 'model' | 'texture' | 'audio' | 'json' | 'font';

export type AssetLoadStatus = 'idle' | 'loading' | 'loaded' | 'failed';

export interface AssetDescriptor {
  readonly id: string;
  readonly kind: AssetKind;
  /** URL relative to the site root (Vite serves /public at /). */
  readonly url: string;
}

export interface AssetProgress {
  readonly loaded: number;
  readonly total: number;
  /** 0..1; 1 when total is 0 (nothing to load). */
  readonly fraction: number;
}
