/**
 * Development-time validator for waveguide domain data integrity. Mirrors
 * AntennaValidation.ts/SignalValidation.ts's contract exactly: pure
 * functions over plain definition data, returning human-readable problem
 * strings — an empty array means valid.
 */
import type { WaveguideDefinition } from './WaveguideDefinition';

export function validateWaveguideDefinitions(paths: readonly WaveguideDefinition[]): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();

  for (const w of paths) {
    if (seenIds.has(w.id)) {
      problems.push(`Duplicate waveguide path id "${w.id}"`);
    }
    seenIds.add(w.id);

    if (w.ports.length < 2) {
      problems.push(`Waveguide "${w.id}" must have at least 2 candidate ports`);
    }
    const portIds = new Set<string>();
    for (const port of w.ports) {
      if (portIds.has(port.id)) {
        problems.push(`Waveguide "${w.id}" has duplicate port id "${port.id}"`);
      }
      portIds.add(port.id);
    }
    if (!w.ports.some((p) => p.id === w.correctPortId)) {
      problems.push(
        `Waveguide "${w.id}" correctPortId "${w.correctPortId}" is not among its ports`,
      );
    }
    if (!w.ports.some((p) => p.id === w.defaultPortId)) {
      problems.push(
        `Waveguide "${w.id}" defaultPortId "${w.defaultPortId}" is not among its ports`,
      );
    }
    if (w.segments.length === 0) {
      problems.push(`Waveguide "${w.id}" has no path segments`);
    }
  }

  return problems;
}

/** Confirms an antenna array's waveguidePathId matches a registered waveguide definition. */
export function validateWaveguideReference(
  waveguidePathId: string,
  registeredPathIds: readonly string[],
): string[] {
  if (!registeredPathIds.includes(waveguidePathId)) {
    return [`Waveguide path "${waveguidePathId}" is not registered`];
  }
  return [];
}
