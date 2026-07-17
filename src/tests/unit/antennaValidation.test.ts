import { describe, expect, it } from 'vitest';
import { validateAntennaDefinitions } from '../../game/antenna/AntennaValidation';
import type { AntennaArrayDefinition } from '../../game/antenna/AntennaArrayDefinition';
import { asAntennaArrayId } from '../../game/antenna/AntennaArrayId';
import { validateWaveguideDefinitions } from '../../game/waveguide/WaveguideValidation';
import type { WaveguideDefinition } from '../../game/waveguide/WaveguideDefinition';

function makeArray(overrides: Partial<AntennaArrayDefinition> = {}): AntennaArrayDefinition {
  return {
    id: asAntennaArrayId('array-1'),
    displayName: 'Array 1',
    role: 'RelayCandidate',
    minAzimuthDeg: -60,
    maxAzimuthDeg: 90,
    minElevationDeg: 0,
    maxElevationDeg: 40,
    minPolarizationDeg: -90,
    maxPolarizationDeg: 90,
    targetAzimuthDeg: 42,
    azimuthToleranceDeg: 8,
    targetElevationDeg: 18,
    elevationToleranceDeg: 6,
    targetPolarizationDeg: -35,
    polarizationToleranceDeg: 12,
    baseGain: 0.8,
    captureWidthDeg: 6,
    maxQuality: 0.95,
    requiredPowerCircuitId: 'circuit-1',
    waveguidePathId: 'waveguide-1',
    receiverCompatible: true,
    selectable: true,
    requiredForProgression: true,
    azimuthSpeedDegPerSecond: 16,
    elevationSpeedDegPerSecond: 12,
    polarizationSpeedDegPerSecond: 25,
    azimuthStepCoarseDeg: 2,
    azimuthStepFineDeg: 0.5,
    elevationStepCoarseDeg: 1.5,
    elevationStepFineDeg: 0.3,
    polarizationStepCoarseDeg: 3,
    polarizationStepFineDeg: 0.5,
    ...overrides,
  };
}

const CTX = { powerCircuitIds: ['circuit-1'], waveguidePathIds: ['waveguide-1'] };

function diagnosticArray(overrides: Partial<AntennaArrayDefinition> = {}): AntennaArrayDefinition {
  return makeArray({
    id: asAntennaArrayId('diag'),
    role: 'DiagnosticLoop',
    ...overrides,
  });
}

describe('validateAntennaDefinitions — happy path', () => {
  it('accepts a well-formed, solvable, non-accidentally-solved array', () => {
    const problems = validateAntennaDefinitions([makeArray(), diagnosticArray()], CTX);
    expect(problems).toEqual([]);
  });
});

describe('validateAntennaDefinitions — duplicate ids', () => {
  it('reports duplicate array ids', () => {
    const problems = validateAntennaDefinitions([makeArray(), makeArray(), diagnosticArray()], CTX);
    expect(problems.some((p) => p.includes('Duplicate'))).toBe(true);
  });
});

describe('validateAntennaDefinitions — invalid angle ranges', () => {
  it('rejects a min >= max azimuth range', () => {
    const problems = validateAntennaDefinitions(
      [makeArray({ minAzimuthDeg: 50, maxAzimuthDeg: 40 }), diagnosticArray()],
      CTX,
    );
    expect(problems.some((p) => p.includes('minAzimuthDeg'))).toBe(true);
  });

  it('rejects an elevation range outside [0,75]', () => {
    const problems = validateAntennaDefinitions(
      [makeArray({ minElevationDeg: -5 }), diagnosticArray()],
      CTX,
    );
    expect(problems.some((p) => p.includes('elevation range'))).toBe(true);
  });

  it('rejects a target outside its own declared range', () => {
    const problems = validateAntennaDefinitions(
      [makeArray({ targetAzimuthDeg: 999 }), diagnosticArray()],
      CTX,
    );
    expect(problems.some((p) => p.includes('targetAzimuthDeg'))).toBe(true);
  });

  it('rejects non-positive tolerances', () => {
    const problems = validateAntennaDefinitions(
      [makeArray({ azimuthToleranceDeg: 0 }), diagnosticArray()],
      CTX,
    );
    expect(problems.some((p) => p.includes('azimuthToleranceDeg'))).toBe(true);
  });
});

describe('validateAntennaDefinitions — missing references', () => {
  it('reports an unknown power circuit reference', () => {
    const problems = validateAntennaDefinitions(
      [makeArray({ requiredPowerCircuitId: 'unknown-circuit' }), diagnosticArray()],
      CTX,
    );
    expect(problems.some((p) => p.includes('unknown power circuit'))).toBe(true);
  });

  it('reports an unknown waveguide path reference', () => {
    const problems = validateAntennaDefinitions(
      [makeArray({ waveguidePathId: 'unknown-path' }), diagnosticArray()],
      CTX,
    );
    expect(problems.some((p) => p.includes('unknown waveguide path'))).toBe(true);
  });
});

describe('validateAntennaDefinitions — reveal reachability', () => {
  it('requires at least one array marked requiredForProgression', () => {
    const problems = validateAntennaDefinitions(
      [
        makeArray({ requiredForProgression: false }),
        diagnosticArray({ requiredForProgression: false }),
      ],
      CTX,
    );
    expect(problems.some((p) => p.includes('requiredForProgression'))).toBe(true);
  });

  it('requires a DiagnosticLoop-role array to exist', () => {
    const problems = validateAntennaDefinitions([makeArray()], CTX);
    expect(problems.some((p) => p.includes('DiagnosticLoop'))).toBe(true);
  });
});

describe('validateAntennaDefinitions — solvability + default-not-solved', () => {
  it('the exact-target achievability check passes for every well-formed array (error is always 0 at the exact target, by construction)', () => {
    // Documents WHY there is no "unsolvable" fixture here: azimuth/elevation/
    // polarization targets are single points, so AntennaEvaluator's falloff
    // functions always return exactly 1.0 per-axis at zero error regardless
    // of how narrow the tolerance is — the achievability check exists as
    // defense-in-depth against a future evaluator change, not because a
    // currently-representable definition can fail it.
    const problems = validateAntennaDefinitions([makeArray(), diagnosticArray()], CTX);
    expect(problems.some((p) => p.includes('not solvable'))).toBe(false);
  });

  it('rejects an array whose default (parked) position is already aligned', () => {
    // Force the parked (min-bound) position to coincide with the target itself.
    const accidentallySolved = makeArray({
      minAzimuthDeg: 42,
      targetAzimuthDeg: 42,
      minElevationDeg: 18,
      targetElevationDeg: 18,
      minPolarizationDeg: -35,
      targetPolarizationDeg: -35,
    });
    const problems = validateAntennaDefinitions([accidentallySolved, diagnosticArray()], CTX);
    expect(problems.some((p) => p.includes('accidentally already aligned'))).toBe(true);
  });
});

// ----- Waveguide validation --------------------------------------------------

const TEST_PORT = { id: 'test-port', displayName: 'Test Port' };
const RECEIVER_A = { id: 'receiver-a', displayName: 'Receiver A' };

function makeWaveguide(overrides: Partial<WaveguideDefinition> = {}): WaveguideDefinition {
  return {
    id: 'wg-1',
    displayName: 'Waveguide 1',
    segments: ['Feed', 'Receiver'],
    ports: [TEST_PORT, RECEIVER_A],
    correctPortId: RECEIVER_A.id,
    defaultPortId: TEST_PORT.id,
    defaultState: 'Misrouted',
    ...overrides,
  };
}

describe('validateWaveguideDefinitions', () => {
  it('accepts a well-formed definition', () => {
    expect(validateWaveguideDefinitions([makeWaveguide()])).toEqual([]);
  });

  it('reports duplicate waveguide ids', () => {
    const problems = validateWaveguideDefinitions([makeWaveguide(), makeWaveguide()]);
    expect(problems.some((p) => p.includes('Duplicate'))).toBe(true);
  });

  it('requires at least 2 candidate ports', () => {
    const problems = validateWaveguideDefinitions([makeWaveguide({ ports: [RECEIVER_A] })]);
    expect(problems.some((p) => p.includes('at least 2'))).toBe(true);
  });

  it('rejects a correctPortId not present among the ports', () => {
    const problems = validateWaveguideDefinitions([makeWaveguide({ correctPortId: 'not-a-port' })]);
    expect(problems.some((p) => p.includes('correctPortId'))).toBe(true);
  });

  it('rejects a defaultPortId not present among the ports', () => {
    const problems = validateWaveguideDefinitions([makeWaveguide({ defaultPortId: 'not-a-port' })]);
    expect(problems.some((p) => p.includes('defaultPortId'))).toBe(true);
  });
});
