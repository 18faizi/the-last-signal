/**
 * Runtime lock state for a single lock.
 *
 * Mutable, owned by the entity that has the lock (e.g. DoorController).
 * 'disabled' means the lock has been permanently bypassed (scripted unlock,
 * power failure, etc.) and will never block access again.
 */
export type LockStateValue = 'locked' | 'unlocking' | 'unlocked' | 'disabled';

export interface LockState {
  readonly lockId: string;
  value: LockStateValue;
}

export function createLock(lockId: string, initialValue: LockStateValue = 'locked'): LockState {
  return { lockId, value: initialValue };
}
