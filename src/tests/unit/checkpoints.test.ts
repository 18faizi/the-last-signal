/**
 * Unit tests for CheckpointSnapshotManager and ProgressionRecoveryValidator.
 */

import { describe, expect, it, vi } from 'vitest';
import { CheckpointSnapshotManager } from '../../game/checkpoint/CheckpointSnapshotManager';
import { ProgressionRecoveryValidator } from '../../game/checkpoint/ProgressionRecoveryValidator';
import type { RuntimeCheckpointSnapshot } from '../../game/checkpoint/RuntimeCheckpointSnapshot';

function createMockSnapshot(
  overrides: Partial<RuntimeCheckpointSnapshot> = {},
): RuntimeCheckpointSnapshot {
  return {
    schemaVersion: 1,
    checkpointId: 'fg-cp-spawn',
    chapterId: 'ch-arrival',
    timestamp: 1000,
    player: { position: [-58, 0.1, 0], yaw: 0 },
    inventory: { itemIds: [], activeSlot: null, inspectionHistory: [] },
    facility: {
      progressionPhase: 'Approach',
      openedDoorIds: [],
      collectedPickupIds: [],
      discoveredZoneIds: ['fg-zone-approach'],
      activatedCheckpointIds: ['fg-cp-spawn'],
    },
    power: {
      generatorState: 'Offline',
      fuelValve: 'Closed',
      starterBattery: 'Disconnected',
      emergencyStop: 'Engaged',
      controlSelector: 'Off',
      mainBreaker: 'Open',
      circuits: {},
      sourceAvailability: {},
      receiverActivated: false,
      powerNetworkOperational: false,
    },
    signal: {
      receiverState: 'Standby',
      currentFrequency: 1420.0,
      bandwidth: 2.5,
      lockConfidence: 0.0,
      decodedTranscripts: [],
    },
    antenna: {
      azimuth: 0,
      elevation: 0,
      alignmentScore: 0,
      waveguideRoute: 'Direct',
      telemetryReport: false,
    },
    threat: {
      phase: 'Dormant',
      alertLevel: 'Green',
      detectionScore: 0.0,
      encounterSurvivals: 0,
    },
    narrative: {
      discoveredFacts: [],
      discoveryTimestamps: {},
    },
    objectives: {
      activeObjectiveId: 'obj-reach-gate',
      objectives: {},
      history: ['obj-reach-gate'],
    },
    hints: {
      activeObjectiveId: 'obj-reach-gate',
      currentTier: 'None',
      elapsedSinceProgressSeconds: 0,
      lastHintText: null,
    },
    ...overrides,
  };
}

describe('ProgressionRecoveryValidator', () => {
  it('validates a correct initial snapshot with no issues', () => {
    const snapshot = createMockSnapshot();
    const result = ProgressionRecoveryValidator.validateSnapshot(snapshot);
    expect(result.isValid).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it('flags invalid schema versions as fatal error', () => {
    const badSnapshot = {
      ...createMockSnapshot(),
      schemaVersion: 2 as unknown as 1,
    };
    const result = ProgressionRecoveryValidator.validateSnapshot(badSnapshot);
    expect(result.isValid).toBe(false);
    expect(result.issues.some((i) => i.code === 'INVALID_SCHEMA_VERSION')).toBe(true);
    expect(result.recommendedAction).toBe('repair');
  });

  it('detects and warns on lethal detection score and sanitizes it', () => {
    const dangerousSnapshot = createMockSnapshot({
      threat: {
        phase: 'Hunting',
        alertLevel: 'Red',
        detectionScore: 1.0,
        encounterSurvivals: 0,
      },
    });
    const result = ProgressionRecoveryValidator.validateSnapshot(dangerousSnapshot);
    expect(result.issues.some((i) => i.code === 'RESTORE_AT_MAX_DETECTION')).toBe(true);

    const sanitized = ProgressionRecoveryValidator.sanitizeSnapshot(dangerousSnapshot);
    expect(sanitized.threat.detectionScore).toBe(0.0);
  });
});

describe('CheckpointSnapshotManager', () => {
  it('captures and stores snapshots from provider', () => {
    const manager = new CheckpointSnapshotManager();
    const provider = vi.fn().mockReturnValue(createMockSnapshot());
    manager.registerProvider(provider);

    const snapshot = manager.captureCheckpoint('fg-cp-gate', 2000);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.checkpointId).toBe('fg-cp-gate');
    expect(snapshot?.timestamp).toBe(2000);

    const retrieved = manager.getSnapshot('fg-cp-gate');
    expect(retrieved).toEqual(snapshot);
    expect(manager.getLatestSnapshot()).toEqual(snapshot);
  });

  it('restores snapshot to registered consumer', () => {
    const manager = new CheckpointSnapshotManager();
    const mockSnap = createMockSnapshot();
    manager.registerProvider(() => mockSnap);
    manager.captureCheckpoint('fg-cp-courtyard');

    const consumer = vi.fn();
    manager.registerConsumer(consumer);

    const res = manager.restoreCheckpoint('fg-cp-courtyard');
    expect(res.success).toBe(true);
    expect(consumer).toHaveBeenCalledWith(
      expect.objectContaining({ checkpointId: 'fg-cp-courtyard' }),
    );
  });
});
