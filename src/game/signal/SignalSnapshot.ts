import type { SignalId } from './SignalId';
import type { ReceiverControls } from './ReceiverControls';
import type { ReceiverMetrics } from './ReceiverMetrics';
import type { SignalLockState } from './SignalLockController';
import type { DecodeState } from './DecodeController';

/**
 * Immutable, plain-data point-in-time view of one signal's evaluation +
 * lock/decode progress — for debug overlays, UI polling and tests. Mirrors
 * PowerSnapshot.ts's role in the power domain.
 */
export interface SignalSnapshot {
  readonly signalId: SignalId;
  readonly controls: Readonly<ReceiverControls>;
  readonly metrics: ReceiverMetrics;
  readonly lockState: SignalLockState;
  readonly acquisitionProgress: number;
  readonly holdQuality: number;
  readonly decodeState: DecodeState;
  readonly decodeProgress: number;
}
