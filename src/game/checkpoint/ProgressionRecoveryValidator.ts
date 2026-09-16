/**
 * Milestone 1.0 — Progression Recovery & Soft-Lock Validator.
 *
 * Inspects runtime snapshots and game state to detect soft-locks or inconsistencies
 * before or during checkpoint restore operations.
 */

import type { RuntimeCheckpointSnapshot } from './RuntimeCheckpointSnapshot';

export interface ValidationIssue {
  readonly severity: 'warning' | 'error';
  readonly code: string;
  readonly message: string;
  readonly suggestedFix?: string;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly recommendedAction?: 'allow' | 'repair' | 'abort';
}

export class ProgressionRecoveryValidator {
  /**
   * Validates a saved runtime snapshot against critical progression rules.
   */
  public static validateSnapshot(snapshot: RuntimeCheckpointSnapshot): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Rule 1: Schema version check
    if ((snapshot as { schemaVersion?: unknown }).schemaVersion !== 1) {
      issues.push({
        severity: 'error',
        code: 'INVALID_SCHEMA_VERSION',
        message: `Snapshot schema version ${String(snapshot.schemaVersion)} is unsupported. Expected version 1.`,
        suggestedFix: 'Re-initialize state from default initial chapter.',
      });
    }

    // Rule 2: Checkpoint ID presence
    if (!snapshot.checkpointId) {
      issues.push({
        severity: 'error',
        code: 'MISSING_CHECKPOINT_ID',
        message: 'Snapshot does not specify a checkpoint ID.',
        suggestedFix: 'Fallback to fg-cp-spawn.',
      });
    }

    // Rule 3: Key item possession vs door state checks
    // If gate is NOT open and player is past gate or inside compound without gate key
    const hasGateKey =
      snapshot.inventory.itemIds.includes('fg-item-gate-key') ||
      snapshot.inventory.itemIds.includes('item-gate-key');
    const isGateOpened =
      snapshot.facility.openedDoorIds.includes('fg-door-gate') ||
      snapshot.facility.openedDoorIds.includes('door-gate');

    if (
      !isGateOpened &&
      !hasGateKey &&
      snapshot.checkpointId !== 'fg-cp-spawn' &&
      snapshot.player.position[0] < -17
    ) {
      // Player is outside, gate locked, no key
      // If checkpoint is outside and item is missing from collected and inventory, could be soft-locked
      const gateKeyCollected =
        snapshot.facility.collectedPickupIds.includes('fg-pickup-gate-key') ||
        snapshot.facility.collectedPickupIds.includes('pickup-gate-key');
      if (gateKeyCollected && !hasGateKey) {
        issues.push({
          severity: 'error',
          code: 'LOST_GATE_KEY',
          message: 'Perimeter gate is locked, key was collected but missing from inventory.',
          suggestedFix: 'Restore gate key to inventory or mark gate unlocked.',
        });
      }
    }

    // Rule 4: Power state consistency for Chapter 5+
    const chaptersRequiringPower = [
      'ch-signal-discovery',
      'ch-source-analysis',
      'ch-threat-aftermath',
      'ch-final-decision',
      'ch-ending',
    ];
    if (chaptersRequiringPower.includes(snapshot.chapterId)) {
      const isGenRunning = snapshot.power.generatorState.toLowerCase() === 'running';
      if (!isGenRunning) {
        issues.push({
          severity: 'warning',
          code: 'POWER_OFFLINE_FOR_ADVANCED_CHAPTER',
          message: `Chapter ${snapshot.chapterId} reached but generator is marked ${snapshot.power.generatorState}.`,
          suggestedFix: 'Allow restore but prompt generator restart if needed.',
        });
      }
    }

    // Rule 5: Threat recovery check
    // If restoring into threat encounter, ensure player is not immediately trapped at lethal detection
    if (snapshot.threat.detectionScore >= 1.0) {
      issues.push({
        severity: 'warning',
        code: 'RESTORE_AT_MAX_DETECTION',
        message:
          'Snapshot has detectionScore >= 1.0. Player would instantly suffer encounter failure.',
        suggestedFix: 'Reset detectionScore to 0.0 on restore.',
      });
    }

    const hasErrors = issues.some((i) => i.severity === 'error');
    return {
      isValid: !hasErrors,
      issues,
      recommendedAction: hasErrors ? 'repair' : 'allow',
    };
  }

  /**
   * Applies non-destructive repairs to a snapshot if recoverable issues exist.
   */
  public static sanitizeSnapshot(snapshot: RuntimeCheckpointSnapshot): RuntimeCheckpointSnapshot {
    let sanitized = { ...snapshot };

    // Fix lethal detection score on restore
    if (sanitized.threat.detectionScore >= 1.0) {
      sanitized = {
        ...sanitized,
        threat: {
          ...sanitized.threat,
          detectionScore: 0.0,
        },
      };
    }

    return sanitized;
  }
}
