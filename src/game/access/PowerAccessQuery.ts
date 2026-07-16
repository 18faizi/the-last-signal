import type { PowerCircuitId } from '../power/PowerCircuitId';

/**
 * Narrow interface AccessEvaluator uses to check circuit power state,
 * implemented by PowerNetwork at the scene-wiring layer. Keeping this a
 * separate interface (rather than importing PowerNetwork directly) means
 * game/access has no runtime dependency on the power domain's concrete
 * implementation — only on this one-method contract.
 */
export interface PowerAccessQuery {
  isCircuitEnergized(circuitId: PowerCircuitId): boolean;
}
