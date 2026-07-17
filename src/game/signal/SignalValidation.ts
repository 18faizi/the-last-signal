/**
 * Development-time validator for signal domain data integrity. Mirrors
 * PowerValidation.ts's contract exactly: pure functions over plain
 * definition data, returning human-readable problem strings — an empty
 * array means valid. Designed to run once at scene-creation time.
 */
import type { SignalDefinition } from './SignalDefinition';
import type { ReceiverControls } from './ReceiverControls';
import { createDefaultReceiverControls } from './ReceiverControls';
import { evaluate } from './SignalEvaluator';
import { MAX_CHANNEL, MIN_CHANNEL, MAX_FREQUENCY_MHZ, MIN_FREQUENCY_MHZ } from './SignalChannel';

export interface SignalValidationContext {
  /** Every registered document id — used to confirm transcriptDocumentId exists. */
  readonly documentIds: readonly string[];
}

export function validateSignalDefinitions(
  signals: readonly SignalDefinition[],
  context: SignalValidationContext,
): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();

  for (const s of signals) {
    if (seenIds.has(s.id)) {
      problems.push(`Duplicate signal id "${s.id}"`);
    }
    seenIds.add(s.id);

    if (s.channel < MIN_CHANNEL || s.channel > MAX_CHANNEL || !Number.isInteger(s.channel)) {
      problems.push(
        `Signal "${s.id}" channel ${s.channel} out of range [${MIN_CHANNEL}, ${MAX_CHANNEL}]`,
      );
    }
    if (s.targetFrequencyMHz < MIN_FREQUENCY_MHZ || s.targetFrequencyMHz > MAX_FREQUENCY_MHZ) {
      problems.push(
        `Signal "${s.id}" targetFrequencyMHz ${s.targetFrequencyMHz} out of range [${MIN_FREQUENCY_MHZ}, ${MAX_FREQUENCY_MHZ}]`,
      );
    }
    if (s.frequencyToleranceMHz <= 0) {
      problems.push(`Signal "${s.id}" frequencyToleranceMHz must be positive`);
    }
    if (s.filterTolerance <= 0) {
      problems.push(`Signal "${s.id}" filterTolerance must be positive`);
    }
    if (s.phaseToleranceDeg <= 0) {
      problems.push(`Signal "${s.id}" phaseToleranceDeg must be positive`);
    }
    if (s.targetGainMin < 0 || s.targetGainMax > 1 || s.targetGainMin > s.targetGainMax) {
      problems.push(
        `Signal "${s.id}" gain range [${s.targetGainMin}, ${s.targetGainMax}] invalid (must be within [0,1] and min ≤ max)`,
      );
    }
    if (s.targetFilter < 0 || s.targetFilter > 1) {
      problems.push(`Signal "${s.id}" targetFilter ${s.targetFilter} out of range [0,1]`);
    }
    if (s.targetPhaseDeg < -180 || s.targetPhaseDeg > 180) {
      problems.push(`Signal "${s.id}" targetPhaseDeg ${s.targetPhaseDeg} out of range [-180,180]`);
    }
    if (s.baseSignalStrength < 0 || s.baseSignalStrength > 1) {
      problems.push(`Signal "${s.id}" baseSignalStrength out of range [0,1]`);
    }
    if (s.baseNoiseLevel < 0 || s.baseNoiseLevel > 1) {
      problems.push(`Signal "${s.id}" baseNoiseLevel out of range [0,1]`);
    }
    if (s.minLockQuality <= 0 || s.minLockQuality > 1) {
      problems.push(`Signal "${s.id}" minLockQuality ${s.minLockQuality} out of range (0,1]`);
    }
    if (s.lockAcquisitionSeconds <= 0) {
      problems.push(`Signal "${s.id}" lockAcquisitionSeconds must be positive`);
    }
    if (s.decodeSeconds <= 0) {
      problems.push(`Signal "${s.id}" decodeSeconds must be positive`);
    }
    if (!context.documentIds.includes(s.transcriptDocumentId)) {
      problems.push(
        `Signal "${s.id}" references unknown transcript document "${s.transcriptDocumentId}"`,
      );
    }

    // Completion mathematically achievable: the canonical target controls
    // must actually clear the lock threshold.
    const target = canonicalTargetControls(s);
    const targetMetrics = evaluate(s, target);
    if (targetMetrics.overallQuality < s.minLockQuality) {
      problems.push(
        `Signal "${s.id}" is not solvable: exact target controls only reach ` +
          `overallQuality ${targetMetrics.overallQuality.toFixed(3)}, below minLockQuality ${s.minLockQuality}`,
      );
    }

    // Default controls must NOT accidentally satisfy lock — the puzzle
    // must require the player to actually tune something.
    const defaultMetrics = evaluate(s, createDefaultReceiverControls());
    if (defaultMetrics.overallQuality >= s.minLockQuality) {
      problems.push(
        `Signal "${s.id}" is accidentally solved by default receiver controls ` +
          `(overallQuality ${defaultMetrics.overallQuality.toFixed(3)} ≥ minLockQuality ${s.minLockQuality})`,
      );
    }
  }

  return problems;
}

/** The exact settings that solve a signal: channel + target frequency/filter/phase, mid-range gain. */
export function canonicalTargetControls(signal: SignalDefinition): ReceiverControls {
  return {
    channel: signal.channel,
    frequencyMHz: signal.targetFrequencyMHz,
    gain: (signal.targetGainMin + signal.targetGainMax) / 2,
    filter: signal.targetFilter,
    phaseDeg: signal.targetPhaseDeg,
  };
}

/**
 * Solver-style check used both by SignalValidation and unit tests: proves a
 * signal is solvable at its exact target, and that small deliberate
 * mis-tunings (one control off by ~2x its tolerance) fail to reach lock —
 * i.e. the puzzle rewards precision rather than being solvable from a wide
 * basin of "close enough" values.
 */
export function solverReport(signal: SignalDefinition): {
  readonly targetQuality: number;
  readonly solvableAtTarget: boolean;
  readonly wrongChannelQuality: number;
  readonly wrongFrequencyQuality: number;
  readonly defaultQuality: number;
  readonly defaultAccidentallySolves: boolean;
} {
  const target = canonicalTargetControls(signal);
  const targetMetrics = evaluate(signal, target);

  const wrongChannel = { ...target, channel: (signal.channel % 6) + 1 };
  const wrongChannelMetrics = evaluate(signal, wrongChannel);

  const wrongFrequency = {
    ...target,
    frequencyMHz: signal.targetFrequencyMHz + signal.frequencyToleranceMHz * 4,
  };
  const wrongFrequencyMetrics = evaluate(signal, wrongFrequency);

  const defaultMetrics = evaluate(signal, createDefaultReceiverControls());

  return {
    targetQuality: targetMetrics.overallQuality,
    solvableAtTarget: targetMetrics.overallQuality >= signal.minLockQuality,
    wrongChannelQuality: wrongChannelMetrics.overallQuality,
    wrongFrequencyQuality: wrongFrequencyMetrics.overallQuality,
    defaultQuality: defaultMetrics.overallQuality,
    defaultAccidentallySolves: defaultMetrics.overallQuality >= signal.minLockQuality,
  };
}

/** Confirms a receiver load id's circuit id matches the expected control-room circuit id. */
export function validateReceiverPowerWiring(
  receiverLoadCircuitId: string,
  expectedControlRoomCircuitId: string,
): string[] {
  if (receiverLoadCircuitId !== expectedControlRoomCircuitId) {
    return [
      `Receiver load circuit "${receiverLoadCircuitId}" does not match the expected control-room circuit "${expectedControlRoomCircuitId}"`,
    ];
  }
  return [];
}
