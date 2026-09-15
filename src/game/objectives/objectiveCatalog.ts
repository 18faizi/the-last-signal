/**
 * Milestone 1.0 — Game Objective Catalog.
 *
 * Defines the complete progression of objectives from Arrival through Post-Completion.
 */

import type { ObjectiveDefinition } from './ObjectiveTypes';

export const OBJECTIVE_CATALOG: readonly ObjectiveDefinition[] = [
  // Chapter 1: Arrival
  {
    id: 'obj-reach-gate',
    chapterId: 'ch-arrival',
    title: 'Reach the Station Perimeter',
    description: 'Follow the access road to the main perimeter gate of Station Echo.',
    category: 'Explore',
    hintText: 'Walk down the path toward the perimeter lights.',
  },
  // Chapter 2: Compound Entry
  {
    id: 'obj-unlock-gate',
    chapterId: 'ch-compound-entry',
    title: 'Gain Entry to the Compound',
    description: 'Unlock the perimeter gate and cross the exterior courtyard to the facility door.',
    category: 'Access',
    hintText: 'Locate the gate key in the guard kiosk or inspect the lock mechanism.',
  },
  // Chapter 3: Facility Investigation
  {
    id: 'obj-enter-facility',
    chapterId: 'ch-facility-investigation',
    title: 'Investigate Facility Ground Floor',
    description: 'Enter the main lobby, assess station status, and search for access logs.',
    category: 'Investigate',
    hintText: 'Inspect the document binder on the lobby security desk.',
    steps: [
      { id: 'step-read-log', description: 'Review the security guard entry log', completed: false },
    ],
  },
  // Chapter 4: Power Restoration
  {
    id: 'obj-restore-power',
    chapterId: 'ch-power-restoration',
    title: 'Restore Station Power',
    description:
      'Navigate to the basement generator room, ignite the diesel engine, and route power to the control wing.',
    category: 'Restore',
    hintText: 'Head down the maintenance stairs to the basement generator vault.',
    steps: [
      { id: 'step-start-gen', description: 'Start the diesel generator', completed: false },
      {
        id: 'step-route-breaker',
        description: 'Route breaker power to the upper control deck',
        completed: false,
      },
    ],
  },
  // Chapter 5: Signal Discovery
  {
    id: 'obj-decode-signal',
    chapterId: 'ch-signal-discovery',
    title: 'Tune and Decode Signal',
    description:
      'Access the second floor control room, calibrate the receiver tuner, and decode the incoming packet.',
    category: 'Operate',
    hintText: 'Interact with the receiver console in the control room.',
    steps: [
      {
        id: 'step-tune-freq',
        description: 'Lock the carrier frequency and filter band',
        completed: false,
      },
      {
        id: 'step-decode-packet',
        description: 'Run demodulator and decode message transcript',
        completed: false,
      },
    ],
  },
  // Chapter 6: Source Analysis
  {
    id: 'obj-analyze-source',
    chapterId: 'ch-source-analysis',
    title: 'Analyze Signal Source',
    description:
      'Align the antenna array to maximize telemetry and run origin analysis on the telemetry terminal.',
    category: 'Operate',
    hintText: 'Align the exterior antenna mast and use the telemetry computer.',
    steps: [
      {
        id: 'step-align-antenna',
        description: 'Align azimuth and elevation waveguides',
        completed: false,
      },
      {
        id: 'step-run-telemetry',
        description: 'Run loopback source telemetry analysis',
        completed: false,
      },
    ],
  },
  // Chapter 7: Threat Aftermath
  {
    id: 'obj-survive-threat',
    chapterId: 'ch-threat-aftermath',
    title: 'Survive Threat Encounter',
    description:
      'The facility grid has suffered an emergency trip. Evade anomalous entity and re-enter the control deck.',
    category: 'Survive',
    hintText: 'Use lockers or dark corners to break line of sight if the entity patrols near.',
  },
  // Chapter 8: Final Decision
  {
    id: 'obj-execute-decision',
    chapterId: 'ch-final-decision',
    title: 'Execute Final Protocol',
    description:
      'Access the station master console and authorize the final transmission directive: Silence, Response, or Archive.',
    category: 'Decide',
    hintText: 'Interact with the master command terminal in the center of the control room.',
  },
  // Chapter 9: Ending
  {
    id: 'obj-witness-ending',
    chapterId: 'ch-ending',
    title: 'Witness Protocol Execution',
    description: 'Stand by as the station system executes your authorized protocol.',
    category: 'Explore',
  },
  // Chapter 10: Post-Completion
  {
    id: 'obj-post-summary',
    chapterId: 'ch-post-completion',
    title: 'Mission Debriefing',
    description: 'Review operational findings and transmission telemetry logs.',
    category: 'Investigate',
  },

  // Optional Objectives
  {
    id: 'obj-opt-all-documents',
    chapterId: 'ch-facility-investigation',
    title: 'Station Archives',
    description: 'Locate and read all 6 archived documents across the facility.',
    category: 'Optional',
    isOptional: true,
  },
];
