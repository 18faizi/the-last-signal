import type { PowerLoadId } from './PowerLoadId';

/** Mutable runtime state for one registered load. Owned by PowerNetwork. */
export interface PowerLoadState {
  readonly loadId: PowerLoadId;
  powered: boolean;
}

export function createPowerLoadState(loadId: PowerLoadId): PowerLoadState {
  return { loadId, powered: false };
}
