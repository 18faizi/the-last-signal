import type { GeneratorState } from './GeneratorState';

export type GeneratorEventKind =
  | 'GeneratorInspected'
  | 'GeneratorReady'
  | 'GeneratorNotReady'
  | 'GeneratorCranking'
  | 'GeneratorStarted'
  | 'GeneratorStable'
  | 'GeneratorStopped'
  | 'GeneratorFaulted'
  | 'MainBreakerOpened'
  | 'MainBreakerClosed'
  | 'ControlChanged';

/**
 * Typed generator event. `control`/`value` populate 'ControlChanged' events
 * for the ancillary controls (fuel valve, starter battery, e-stop, selector)
 * so debug views and PoweredStateBinding-style listeners can react to any
 * single field without a bespoke event per control.
 */
export interface GeneratorEvent {
  readonly kind: GeneratorEventKind;
  readonly state?: GeneratorState;
  readonly control?: 'fuelValve' | 'starterBattery' | 'emergencyStop' | 'selector' | 'mainBreaker';
  readonly value?: string;
  readonly reason?: string;
}
