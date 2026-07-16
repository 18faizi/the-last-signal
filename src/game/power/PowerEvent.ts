import type { PowerCircuitId } from './PowerCircuitId';
import type { PowerLoadId } from './PowerLoadId';
import type { PowerSourceId } from './PowerSourceId';
import type { PowerSourceAvailability } from './PowerSourceState';

export type PowerEventKind =
  | 'source-state-changed'
  | 'circuit-requested'
  | 'circuit-energized'
  | 'circuit-de-energized'
  | 'allocation-rejected'
  | 'capacity-changed'
  | 'load-powered'
  | 'load-unpowered'
  | 'emergency-transfer';

/**
 * Typed event emitted by PowerNetwork. Fields are optional per-kind; callers
 * narrow on `kind`. No Babylon/DOM data ever appears here.
 */
export interface PowerEvent {
  readonly kind: PowerEventKind;
  readonly sourceId?: PowerSourceId;
  readonly circuitId?: PowerCircuitId;
  readonly loadId?: PowerLoadId;
  readonly availability?: PowerSourceAvailability;
  readonly reason?: string;
}
