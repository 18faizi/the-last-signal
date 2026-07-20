/**
 * Manifestation lifecycle states (Milestone 0.9). Small and linear:
 * Idle -> Active -> Completed, with Completed manifestations replayable only
 * through an explicit dev reset (the ManifestationController enforces the
 * one-shot rule; this module just names the states).
 */
export type ManifestationState = 'Idle' | 'Active' | 'Completed';

const TRANSITIONS: Readonly<Record<ManifestationState, readonly ManifestationState[]>> = {
  Idle: ['Active'],
  Active: ['Completed'],
  Completed: [],
};

export function canTransitionManifestation(
  from: ManifestationState,
  to: ManifestationState,
): boolean {
  return TRANSITIONS[from].includes(to);
}
