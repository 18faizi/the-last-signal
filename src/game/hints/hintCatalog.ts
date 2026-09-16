/**
 * Milestone 1.0 — Hint Catalog.
 *
 * Tiered contextual hints for each main objective:
 * Subtle (environmental observation), Directional (room/vector guidance),
 * Specific (precise interaction instructions).
 */

import type { ObjectiveHintDefinition } from './HintTypes';

export const HINT_CATALOG: readonly ObjectiveHintDefinition[] = [
  {
    objectiveId: 'obj-reach-gate',
    subtle: 'The wind is howling from the north along the perimeter fence.',
    directional: 'Follow the roadway lights towards the security checkpoint guard booth.',
    specific: 'Walk forward to the metal gate at the end of the access road.',
  },
  {
    objectiveId: 'obj-unlock-gate',
    subtle: 'The compound gate is secured with a physical padlock.',
    directional: 'The guard kiosk by the gate might hold an access key or mechanism.',
    specific:
      'Check the guard booth table or nearby locker to find the perimeter gate key, then interact with the gate.',
  },
  {
    objectiveId: 'obj-enter-facility',
    subtle: 'The facility reception area looks dark and deserted.',
    directional: 'Head into the lobby reception desk to see if anything was left behind.',
    specific: 'Read the Security Guard Entry Log document resting on the main desk.',
  },
  {
    objectiveId: 'obj-restore-power',
    subtle: 'The electrical circuits are cold. Heavy conduits lead downstairs.',
    directional: 'Take the basement stairwell down to the generator room.',
    specific:
      'Ignite the diesel generator unit, then switch on the breaker feeding the second floor control room.',
  },
  {
    objectiveId: 'obj-decode-signal',
    subtle: 'Static hiss emanates from the main radio console on the upper floor.',
    directional: 'Upstairs in the control room, inspect the receiver console.',
    specific:
      'Tune the receiver frequency to the anomalous carrier, match the filter band, and press Demodulate.',
  },
  {
    objectiveId: 'obj-analyze-source',
    subtle: 'The telemetry dishes on the tower require physical realignment for full SNR.',
    directional:
      'Calibrate the antenna elevation and azimuth controls, then return to the terminal.',
    specific:
      'Align antenna waveguides on the roof/tower, then run source analysis on the telemetry terminal.',
  },
  {
    objectiveId: 'obj-survive-threat',
    subtle: 'Heavy metallic footsteps reverberate through the ventilation ducts.',
    directional:
      'Stay low, break line of sight, and hide in lockers or shadowed alcoves if detected.',
    specific:
      'Wait for the entity to move away or patrol past, then sprint to the control room entrance.',
  },
  {
    objectiveId: 'obj-execute-decision',
    subtle: 'The station central command terminal is blinking, awaiting final protocol entry.',
    directional: 'Examine the options on the master console in the control room.',
    specific:
      'Select one of the three final protocols (Silence, Response, or Archive) and confirm authorization.',
  },
];
