/**
 * Typed event-director conditions (Milestone 0.9).
 *
 * A condition is plain data evaluated against an EventConditionContext of
 * narrow query callbacks supplied by the scene bindings — the director
 * never imports PowerNetwork/ReceiverController/etc. directly, keeping the
 * domain pure and every query explicit. NO string scripting anywhere.
 */
import type { ThreatProgressionPhase } from '../threat/ThreatProgressionPhase';
import type { ThreatState } from '../threat/ThreatState';

export type EventCondition =
  | { readonly kind: 'antenna-reveal-complete' }
  | { readonly kind: 'threat-phase-at-least'; readonly phase: ThreatProgressionPhase }
  | { readonly kind: 'zone-discovered'; readonly zoneId: string }
  | { readonly kind: 'zone-inside'; readonly zoneId: string }
  | { readonly kind: 'circuit-energized'; readonly circuitId: string; readonly energized: boolean }
  | { readonly kind: 'signal-decoded'; readonly signalId: string }
  | { readonly kind: 'door-open'; readonly doorId: string; readonly open: boolean }
  | { readonly kind: 'inventory-has'; readonly itemId: string }
  | { readonly kind: 'time-since-event'; readonly eventId: string; readonly seconds: number }
  | { readonly kind: 'threat-state'; readonly state: ThreatState }
  | { readonly kind: 'player-in-gameplay-mode' }
  | { readonly kind: 'event-completed'; readonly eventId: string };

/** Narrow query surface the scene bindings implement. */
export interface EventConditionContext {
  isAntennaRevealComplete(): boolean;
  compareThreatPhase(phase: ThreatProgressionPhase): number;
  isZoneDiscovered(zoneId: string): boolean;
  isZoneInside(zoneId: string): boolean;
  isCircuitEnergized(circuitId: string): boolean;
  isSignalDecoded(signalId: string): boolean;
  isDoorOpen(doorId: string): boolean;
  hasInventoryItem(itemId: string): boolean;
  /** Seconds since the referenced event fired, or null when it never fired. */
  secondsSinceEvent(eventId: string): number | null;
  getThreatState(): ThreatState;
  /** True when the player is in plain gameplay (no overlay/panel/hiding). */
  isPlayerInGameplayMode(): boolean;
  isEventCompleted(eventId: string): boolean;
}

export function evaluateCondition(condition: EventCondition, ctx: EventConditionContext): boolean {
  switch (condition.kind) {
    case 'antenna-reveal-complete':
      return ctx.isAntennaRevealComplete();
    case 'threat-phase-at-least':
      return ctx.compareThreatPhase(condition.phase) >= 0;
    case 'zone-discovered':
      return ctx.isZoneDiscovered(condition.zoneId);
    case 'zone-inside':
      return ctx.isZoneInside(condition.zoneId);
    case 'circuit-energized':
      return ctx.isCircuitEnergized(condition.circuitId) === condition.energized;
    case 'signal-decoded':
      return ctx.isSignalDecoded(condition.signalId);
    case 'door-open':
      return ctx.isDoorOpen(condition.doorId) === condition.open;
    case 'inventory-has':
      return ctx.hasInventoryItem(condition.itemId);
    case 'time-since-event': {
      const elapsed = ctx.secondsSinceEvent(condition.eventId);
      return elapsed !== null && elapsed >= condition.seconds;
    }
    case 'threat-state':
      return ctx.getThreatState() === condition.state;
    case 'player-in-gameplay-mode':
      return ctx.isPlayerInGameplayMode();
    case 'event-completed':
      return ctx.isEventCompleted(condition.eventId);
  }
}

export function evaluateAllConditions(
  conditions: readonly EventCondition[],
  ctx: EventConditionContext,
): boolean {
  for (const condition of conditions) {
    if (!evaluateCondition(condition, ctx)) return false;
  }
  return true;
}
