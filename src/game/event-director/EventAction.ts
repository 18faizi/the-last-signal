/**
 * Typed event-director actions (Milestone 0.9).
 *
 * Actions are TYPED OBJECTS executed in authored order by an
 * EventActionExecutor implemented in the scene bindings — there is no
 * string-script execution anywhere. Adding a new action kind is a type
 * change, caught at compile time in every executor.
 */
import type { Point3 } from '../facility/FacilityZone';
import type { ThreatProgressionPhase } from '../threat/ThreatProgressionPhase';

export type EventAction =
  | { readonly kind: 'begin-manifestation'; readonly manifestationId: string }
  | {
      readonly kind: 'set-light';
      readonly lightId: string;
      readonly mode: 'on' | 'off' | 'blink' | 'cut';
    }
  | { readonly kind: 'operate-door'; readonly doorId: string; readonly operation: 'open' | 'close' }
  | { readonly kind: 'phone-indicator'; readonly messageId: string }
  | { readonly kind: 'begin-encounter'; readonly encounterId: string }
  | { readonly kind: 'enable-hiding-prompts' }
  | { readonly kind: 'set-checkpoint'; readonly checkpointId: string }
  | { readonly kind: 'dev-message'; readonly text: string }
  | { readonly kind: 'threat-manifest'; readonly nodeId: string }
  | {
      readonly kind: 'threat-resolve-manifestation';
      readonly outcome: 'observe' | 'inactive';
    }
  | { readonly kind: 'threat-activate-unaware'; readonly nodeId: string }
  | { readonly kind: 'threat-route-to'; readonly nodeId: string }
  | { readonly kind: 'threat-investigate'; readonly position: Point3 }
  | { readonly kind: 'threat-withdraw'; readonly final: boolean }
  | { readonly kind: 'complete-encounter'; readonly encounterId: string }
  | { readonly kind: 'advance-threat-phase'; readonly phase: ThreatProgressionPhase };

export interface EventActionExecutor {
  execute(action: EventAction): void;
}
