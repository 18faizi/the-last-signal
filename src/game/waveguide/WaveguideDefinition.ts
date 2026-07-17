import type { WaveguideState } from './WaveguideState';

/** One selectable port at the junction box (a physical routing choice). */
export interface WaveguideRoutePort {
  readonly id: string;
  readonly displayName: string;
}

/**
 * Static, immutable description of one waveguide path: antenna feed →
 * rooftop waveguide run → control-building feedthrough → receiver routing.
 * Mirrors AntennaArrayDefinition.ts's shape: plain data, no Babylon/DOM,
 * validated once at scene-creation time by WaveguideValidation.
 */
export interface WaveguideDefinition {
  readonly id: string;
  readonly displayName: string;
  /** Descriptive path segment labels, feed → receiver, for UI/debug display only. */
  readonly segments: readonly string[];
  /** Every port selectable at the junction box for this path. */
  readonly ports: readonly WaveguideRoutePort[];
  readonly correctPortId: string;
  /**
   * Where this path starts. Not every waveguide needs a puzzle — e.g. the
   * North Dish's path may start already correctly routed while the East
   * Relay Dish's path deliberately starts Misrouted per spec §23.
   */
  readonly defaultPortId: string;
  readonly defaultState: WaveguideState;
}
