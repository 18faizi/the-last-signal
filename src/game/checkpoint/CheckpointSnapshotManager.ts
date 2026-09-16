/**
 * Milestone 1.0 — Checkpoint Snapshot Manager.
 *
 * Coordinates atomic capture and restoration of runtime game state snapshots.
 * Validates snapshots with ProgressionRecoveryValidator before restoring.
 */

import { type RuntimeCheckpointSnapshot } from './RuntimeCheckpointSnapshot';
import {
  ProgressionRecoveryValidator,
  type ValidationResult,
} from './ProgressionRecoveryValidator';

export type SnapshotProvider = () => Omit<
  RuntimeCheckpointSnapshot,
  'schemaVersion' | 'timestamp' | 'checkpointId'
>;
export type SnapshotConsumer = (snapshot: RuntimeCheckpointSnapshot) => void;

export class CheckpointSnapshotManager {
  private readonly snapshots = new Map<string, RuntimeCheckpointSnapshot>();
  private latestCheckpointId: string | null = null;
  private snapshotProvider?: SnapshotProvider;
  private snapshotConsumer?: SnapshotConsumer;

  constructor(private readonly maxStoredSnapshots: number = 20) {}

  public registerProvider(provider: SnapshotProvider): void {
    this.snapshotProvider = provider;
  }

  public registerConsumer(consumer: SnapshotConsumer): void {
    this.snapshotConsumer = consumer;
  }

  public captureCheckpoint(
    checkpointId: string,
    now: number = Date.now(),
  ): RuntimeCheckpointSnapshot | null {
    if (!this.snapshotProvider) {
      console.warn('[CheckpointSnapshotManager] No snapshot provider registered.');
      return null;
    }

    const raw = this.snapshotProvider();
    const snapshot: RuntimeCheckpointSnapshot = {
      ...raw,
      schemaVersion: 1,
      timestamp: now,
      checkpointId,
    };

    // Store in history
    this.snapshots.set(checkpointId, snapshot);
    this.latestCheckpointId = checkpointId;

    // Prune if exceeds max limit (keep latest)
    if (this.snapshots.size > this.maxStoredSnapshots) {
      const oldestKey = this.snapshots.keys().next().value;
      if (oldestKey && oldestKey !== checkpointId) {
        this.snapshots.delete(oldestKey);
      }
    }

    return snapshot;
  }

  public getSnapshot(checkpointId: string): RuntimeCheckpointSnapshot | undefined {
    return this.snapshots.get(checkpointId);
  }

  public getLatestSnapshot(): RuntimeCheckpointSnapshot | null {
    if (!this.latestCheckpointId) return null;
    return this.snapshots.get(this.latestCheckpointId) ?? null;
  }

  public restoreCheckpoint(checkpointId: string): {
    success: boolean;
    validation: ValidationResult;
  } {
    const snapshot = this.snapshots.get(checkpointId);
    if (!snapshot) {
      return {
        success: false,
        validation: {
          isValid: false,
          issues: [
            {
              severity: 'error',
              code: 'SNAPSHOT_NOT_FOUND',
              message: `No snapshot exists for checkpoint ${checkpointId}.`,
            },
          ],
          recommendedAction: 'abort',
        },
      };
    }

    const validation = ProgressionRecoveryValidator.validateSnapshot(snapshot);
    if (!validation.isValid && validation.recommendedAction === 'abort') {
      return { success: false, validation };
    }

    const cleanSnapshot = ProgressionRecoveryValidator.sanitizeSnapshot(snapshot);
    if (this.snapshotConsumer) {
      this.snapshotConsumer(cleanSnapshot);
      this.latestCheckpointId = checkpointId;
      return { success: true, validation };
    } else {
      return {
        success: false,
        validation: {
          isValid: false,
          issues: [
            {
              severity: 'error',
              code: 'NO_CONSUMER',
              message: 'No snapshot consumer registered to apply state.',
            },
          ],
          recommendedAction: 'abort',
        },
      };
    }
  }

  public restoreLatest(): { success: boolean; validation?: ValidationResult } {
    if (!this.latestCheckpointId) {
      return { success: false };
    }
    return this.restoreCheckpoint(this.latestCheckpointId);
  }

  public clear(): void {
    this.snapshots.clear();
    this.latestCheckpointId = null;
  }
}
