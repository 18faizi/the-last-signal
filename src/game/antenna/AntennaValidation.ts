/**
 * Development-time validator for antenna domain data integrity. Mirrors
 * SignalValidation.ts/PowerValidation.ts's contract exactly: pure functions
 * over plain definition data, returning human-readable problem strings — an
 * empty array means valid. Designed to run once at scene-creation time.
 */
import type { AntennaArrayDefinition } from './AntennaArrayDefinition';
import { evaluate } from './AntennaEvaluator';
import {
  createDefaultAntennaMechanicalState,
  type AntennaMechanicalState,
} from './AntennaMechanicalState';

export interface AntennaValidationContext {
  /** Every registered power circuit id — confirms requiredPowerCircuitId exists. */
  readonly powerCircuitIds: readonly string[];
  /** Every registered waveguide path id — confirms waveguidePathId exists. */
  readonly waveguidePathIds: readonly string[];
}

export function validateAntennaDefinitions(
  arrays: readonly AntennaArrayDefinition[],
  context: AntennaValidationContext,
): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();

  for (const a of arrays) {
    if (seenIds.has(a.id)) {
      problems.push(`Duplicate antenna array id "${a.id}"`);
    }
    seenIds.add(a.id);

    if (a.minAzimuthDeg >= a.maxAzimuthDeg) {
      problems.push(`Array "${a.id}" minAzimuthDeg must be less than maxAzimuthDeg`);
    }
    if (a.minElevationDeg >= a.maxElevationDeg) {
      problems.push(`Array "${a.id}" minElevationDeg must be less than maxElevationDeg`);
    }
    if (a.minElevationDeg < 0 || a.maxElevationDeg > 75) {
      problems.push(`Array "${a.id}" elevation range must be within [0, 75]`);
    }
    if (a.minPolarizationDeg >= a.maxPolarizationDeg) {
      problems.push(`Array "${a.id}" minPolarizationDeg must be less than maxPolarizationDeg`);
    }
    if (a.targetAzimuthDeg < a.minAzimuthDeg || a.targetAzimuthDeg > a.maxAzimuthDeg) {
      problems.push(`Array "${a.id}" targetAzimuthDeg out of its own [min,max] range`);
    }
    if (a.targetElevationDeg < a.minElevationDeg || a.targetElevationDeg > a.maxElevationDeg) {
      problems.push(`Array "${a.id}" targetElevationDeg out of its own [min,max] range`);
    }
    if (
      a.targetPolarizationDeg < a.minPolarizationDeg ||
      a.targetPolarizationDeg > a.maxPolarizationDeg
    ) {
      problems.push(`Array "${a.id}" targetPolarizationDeg out of its own [min,max] range`);
    }
    if (a.azimuthToleranceDeg <= 0)
      problems.push(`Array "${a.id}" azimuthToleranceDeg must be positive`);
    if (a.elevationToleranceDeg <= 0)
      problems.push(`Array "${a.id}" elevationToleranceDeg must be positive`);
    if (a.polarizationToleranceDeg <= 0)
      problems.push(`Array "${a.id}" polarizationToleranceDeg must be positive`);
    if (a.baseGain < 0 || a.baseGain > 1)
      problems.push(`Array "${a.id}" baseGain out of range [0,1]`);
    if (a.maxQuality <= 0 || a.maxQuality > 1) {
      problems.push(`Array "${a.id}" maxQuality out of range (0,1]`);
    }
    if (a.captureWidthDeg <= 0) problems.push(`Array "${a.id}" captureWidthDeg must be positive`);
    if (
      a.azimuthSpeedDegPerSecond <= 0 ||
      a.elevationSpeedDegPerSecond <= 0 ||
      a.polarizationSpeedDegPerSecond <= 0
    ) {
      problems.push(`Array "${a.id}" mechanical speeds must all be positive`);
    }
    if (!context.powerCircuitIds.includes(a.requiredPowerCircuitId)) {
      problems.push(
        `Array "${a.id}" references unknown power circuit "${a.requiredPowerCircuitId}"`,
      );
    }
    if (!context.waveguidePathIds.includes(a.waveguidePathId)) {
      problems.push(`Array "${a.id}" references unknown waveguide path "${a.waveguidePathId}"`);
    }

    // Achievable: exact target position, full power + full waveguide continuity
    // must actually clear a "meaningfully aligned" quality (0.9 of maxQuality).
    const target = canonicalTargetMechanical(a);
    const targetMetrics = evaluate(a, {
      activeArrayId: a.id,
      mechanical: target,
      waveguideQuality: 1,
      powered: true,
    });
    if (targetMetrics.overallQuality < a.maxQuality * 0.9) {
      problems.push(
        `Array "${a.id}" is not solvable: exact target position only reaches overallQuality ` +
          `${targetMetrics.overallQuality.toFixed(3)}, expected at least ${(a.maxQuality * 0.9).toFixed(3)}`,
      );
    }

    // Default (parked) position must NOT accidentally already be aligned.
    // Mirrors AntennaController.registerArray's park-at-minimum-bound logic
    // exactly (see its doc comment for why 0 is not used).
    const parkAzimuthDeg = a.minAzimuthDeg;
    const parkElevationDeg = a.minElevationDeg;
    const parkPolarizationDeg = a.minPolarizationDeg;
    const parked = createDefaultAntennaMechanicalState(
      parkAzimuthDeg,
      parkElevationDeg,
      parkPolarizationDeg,
    );
    const parkedMetrics = evaluate(a, {
      activeArrayId: a.id,
      mechanical: parked,
      waveguideQuality: 1,
      powered: true,
    });
    if (parkedMetrics.overallQuality >= a.maxQuality * 0.9) {
      problems.push(
        `Array "${a.id}" default parked position is accidentally already aligned ` +
          `(overallQuality ${parkedMetrics.overallQuality.toFixed(3)})`,
      );
    }
  }

  if (!arrays.some((a) => a.requiredForProgression)) {
    problems.push('No antenna array is marked requiredForProgression — reveal path unreachable');
  }
  if (!arrays.some((a) => a.role === 'DiagnosticLoop')) {
    problems.push('No antenna array has role "DiagnosticLoop" — diagnostic loop array missing');
  }

  return problems;
}

/** The exact settings that solve an array's alignment: target az/el/pol, mechanically settled. */
export function canonicalTargetMechanical(def: AntennaArrayDefinition): AntennaMechanicalState {
  return createDefaultAntennaMechanicalState(
    def.targetAzimuthDeg,
    def.targetElevationDeg,
    def.targetPolarizationDeg,
  );
}

/** Confirms an array's requiredPowerCircuitId matches the expected rooftop circuit id. */
export function validateAntennaPowerWiring(
  arrayCircuitId: string,
  expectedRooftopCircuitId: string,
): string[] {
  if (arrayCircuitId !== expectedRooftopCircuitId) {
    return [
      `Antenna array circuit "${arrayCircuitId}" does not match the expected rooftop circuit "${expectedRooftopCircuitId}"`,
    ];
  }
  return [];
}
