/**
 * Pure formatter: turns a GeneratorController snapshot into compact debug
 * lines. Reused by both the F3 overlay extension and the F10 power debug
 * overlay — no Babylon/DOM here, just strings.
 */
import type { GeneratorControllerSnapshot } from './GeneratorController';

export function formatGeneratorDebugFields(
  snapshot: GeneratorControllerSnapshot,
): ReadonlyArray<readonly [string, string]> {
  return [
    ['Gen state', snapshot.state],
    ['Fuel valve', snapshot.fuelValve],
    ['Starter battery', snapshot.starterBattery],
    ['E-stop', snapshot.emergencyStop],
    ['Selector', snapshot.selector],
    ['Main breaker', snapshot.mainBreaker],
    ['Warm-up', `${Math.round(snapshot.warmUpProgress * 100)}%`],
    ['Inspected', snapshot.inspected ? 'yes' : 'no'],
  ];
}
