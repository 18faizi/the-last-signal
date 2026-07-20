/**
 * Authored reactive events + the first encounter (Milestone 0.9, spec
 * sections 33 and 36).
 *
 * Four events, strictly typed, dependency-chained A -> B -> C -> D:
 *
 *  A  fg-event-rooftop-aftermath   — post-reveal aftermath on the rooftop:
 *     warning light blinks then cuts, a distant stairwell silhouette
 *     appears briefly (disappears on obstruction/timeout). No pursuit.
 *  B  fg-event-control-disturbance — back inside the control room: the
 *     corridor light drops out, the entrance door swings closed, the duty
 *     phone indicator blinks, a presence crosses the far doorway.
 *  C  fg-event-first-investigation — the encounter proper begins: encounter
 *     checkpoint set, hiding prompts armed, the threat activates Unaware on
 *     the relay level and patrols down; real player stimuli drive its
 *     investigation (avoidable by stillness/hiding — nothing scripted).
 *  D  fg-event-safe-zone-resolution — the pursued player reached the lobby
 *     safe zone: the encounter completes (one-shot), the threat withdraws,
 *     the corridor light is restored.
 *
 * The encounter itself is completed/failed by the threat bindings reacting
 * to REAL threat events (SafeZoneRefusal, PlayerCaptured) — the director
 * only sequences the authored beats.
 */
import type { EventDefinition } from '../../../game/event-director/EventDefinition';
import type { EncounterResetPlan } from '../../../game/threat/behavior/ThreatEncounterRules';
import {
  CHECKPOINT_ENCOUNTER_START,
  ENCOUNTER_FIRST_CONTACT_ID,
  LIGHT_CTRL_CORRIDOR,
  LIGHT_ROOFTOP_WARNING,
  MANIFEST_CORRIDOR_LIGHT,
  MANIFEST_DOORWAY_CROSSING,
  MANIFEST_LOBBY_PHONE,
  MANIFEST_STAIRWELL_SILHOUETTE,
  PHONE_DUTY_DESK,
  TNODE_CTRL_WEST,
  TNODE_RELAY_MID,
} from './facilityThreatDefinitions';

export const EVENT_ROOFTOP_AFTERMATH = 'fg-event-rooftop-aftermath';
export const EVENT_THREAT_REACTIVATE = 'fg-event-threat-reactivate';
export const EVENT_CONTROL_DISTURBANCE = 'fg-event-control-disturbance';
export const EVENT_FIRST_INVESTIGATION = 'fg-event-first-investigation';
export const EVENT_SAFE_ZONE_RESOLUTION = 'fg-event-safe-zone-resolution';

export const FACILITY_THREAT_EVENTS: readonly EventDefinition[] = [
  {
    id: EVENT_ROOFTOP_AFTERMATH,
    label: 'Rooftop aftermath',
    conditions: [
      { kind: 'antenna-reveal-complete' },
      { kind: 'threat-phase-at-least', phase: 'AntennaAftermathPending' },
      { kind: 'player-in-gameplay-mode' },
    ],
    dependencies: [],
    oneShot: true,
    delaySeconds: 2,
    actions: [
      { kind: 'set-light', lightId: LIGHT_ROOFTOP_WARNING, mode: 'blink' },
      { kind: 'begin-manifestation', manifestationId: MANIFEST_STAIRWELL_SILHOUETTE },
      { kind: 'advance-threat-phase', phase: 'FirstManifestation' },
      { kind: 'dev-message', text: 'EVENT A: rooftop aftermath' },
    ],
  },
  {
    id: EVENT_CONTROL_DISTURBANCE,
    label: 'Control building disturbance',
    conditions: [
      { kind: 'zone-inside', zoneId: 'fg-zone-control-room' },
      { kind: 'time-since-event', eventId: EVENT_ROOFTOP_AFTERMATH, seconds: 8 },
      { kind: 'player-in-gameplay-mode' },
    ],
    dependencies: [EVENT_ROOFTOP_AFTERMATH],
    oneShot: true,
    delaySeconds: 1.5,
    actions: [
      { kind: 'set-light', lightId: LIGHT_ROOFTOP_WARNING, mode: 'cut' },
      { kind: 'set-light', lightId: LIGHT_CTRL_CORRIDOR, mode: 'off' },
      { kind: 'begin-manifestation', manifestationId: MANIFEST_CORRIDOR_LIGHT },
      { kind: 'operate-door', doorId: 'fg-door-control-entrance', operation: 'close' },
      { kind: 'phone-indicator', messageId: PHONE_DUTY_DESK },
      { kind: 'advance-threat-phase', phase: 'DisturbanceSequence' },
      { kind: 'dev-message', text: 'EVENT B: control building disturbance' },
    ],
  },
  {
    id: EVENT_FIRST_INVESTIGATION,
    label: 'First investigation encounter',
    conditions: [
      { kind: 'zone-inside', zoneId: 'fg-zone-control-room' },
      { kind: 'time-since-event', eventId: EVENT_CONTROL_DISTURBANCE, seconds: 5 },
      { kind: 'player-in-gameplay-mode' },
    ],
    dependencies: [EVENT_CONTROL_DISTURBANCE],
    oneShot: true,
    delaySeconds: 0,
    actions: [
      { kind: 'set-checkpoint', checkpointId: CHECKPOINT_ENCOUNTER_START },
      { kind: 'begin-encounter', encounterId: ENCOUNTER_FIRST_CONTACT_ID },
      { kind: 'enable-hiding-prompts' },
      { kind: 'begin-manifestation', manifestationId: MANIFEST_DOORWAY_CROSSING },
      { kind: 'begin-manifestation', manifestationId: MANIFEST_LOBBY_PHONE },
      { kind: 'threat-activate-unaware', nodeId: TNODE_RELAY_MID },
      { kind: 'threat-route-to', nodeId: TNODE_CTRL_WEST },
      { kind: 'dev-message', text: 'EVENT C: encounter active — threat is listening' },
    ],
  },
  {
    // Repeatable keeper: while the encounter is active (post-C) and the
    // threat has withdrawn back to Dormant without a resolution, it
    // re-activates after a beat so the encounter can always be finished.
    // Once Event D resolves, the final withdraw ends at Inactive — this
    // event's 'threat-state Dormant' condition can then never hold again.
    id: EVENT_THREAT_REACTIVATE,
    label: 'Threat re-activation keeper',
    conditions: [
      { kind: 'threat-state', state: 'Dormant' },
      { kind: 'zone-inside', zoneId: 'fg-zone-control-room' },
    ],
    dependencies: [EVENT_FIRST_INVESTIGATION],
    oneShot: false,
    delaySeconds: 3,
    actions: [
      { kind: 'threat-activate-unaware', nodeId: TNODE_RELAY_MID },
      { kind: 'threat-route-to', nodeId: TNODE_CTRL_WEST },
      { kind: 'dev-message', text: 'Threat re-activated (keeper)' },
    ],
  },
  {
    id: EVENT_SAFE_ZONE_RESOLUTION,
    label: 'Safe zone resolution',
    conditions: [{ kind: 'threat-phase-at-least', phase: 'SafeZoneReached' }],
    dependencies: [EVENT_FIRST_INVESTIGATION],
    oneShot: true,
    delaySeconds: 0.5,
    actions: [
      { kind: 'complete-encounter', encounterId: ENCOUNTER_FIRST_CONTACT_ID },
      // Final withdraw: the resolved threat ends INACTIVE, so the
      // re-activation keeper can never restart the finished encounter.
      { kind: 'threat-withdraw', final: true },
      { kind: 'set-light', lightId: LIGHT_CTRL_CORRIDOR, mode: 'on' },
      { kind: 'dev-message', text: 'EVENT D: encounter resolved at safe zone' },
    ],
  },
];

/**
 * Encounter failure reset plan: ONLY what is listed here is touched.
 * Inventory, power, signal, antenna progression and every non-listed door
 * are structurally untouched by the reset executor.
 */
export const FIRST_CONTACT_RESET_PLAN: EncounterResetPlan = {
  encounterId: ENCOUNTER_FIRST_CONTACT_ID,
  checkpointId: CHECKPOINT_ENCOUNTER_START,
  threatResetNodeId: TNODE_RELAY_MID,
  doorResets: [{ doorId: 'fg-door-control-entrance', open: false }],
  devMessage: 'ENCOUNTER RESET',
};
