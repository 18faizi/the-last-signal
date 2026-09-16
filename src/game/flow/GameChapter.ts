/**
 * Explicit narrative chapter model for The Last Signal (Milestone 1.0).
 *
 * Coordinates high-level story progression across the complete critical path:
 * 1. Arrival — Mountain approach to the perimeter
 * 2. CompoundEntry — Bypassing the perimeter gate into the courtyard
 * 3. FacilityInvestigation — Entering the control building & discovering power outage
 * 4. PowerRestoration — Navigating to generator, startup sequence & circuit routing
 * 5. SignalDiscovery — Operating receiver, tuning & anomalous transmission decode
 * 6. SourceAnalysis — Rooftop antenna deck, waveguide route & local-loop contradiction
 * 7. ThreatAftermath — Rooftop anomaly, control disturbance & stealth encounter
 * 8. FinalDecision — Unlocking the control room console & selecting ending
 * 9. Ending — In-engine ending sequence execution
 * 10. PostCompletion — Post-ending summary card and restart/continue state
 */

export type GameChapter =
  | 'Arrival'
  | 'CompoundEntry'
  | 'FacilityInvestigation'
  | 'PowerRestoration'
  | 'SignalDiscovery'
  | 'SourceAnalysis'
  | 'ThreatAftermath'
  | 'FinalDecision'
  | 'Ending'
  | 'PostCompletion';

export type GameChapterId = GameChapter;

export type EndingPathway = 'SILENCE' | 'RESPONSE' | 'ARCHIVE';

export const ALL_GAME_CHAPTERS: readonly GameChapter[] = [
  'Arrival',
  'CompoundEntry',
  'FacilityInvestigation',
  'PowerRestoration',
  'SignalDiscovery',
  'SourceAnalysis',
  'ThreatAftermath',
  'FinalDecision',
  'Ending',
  'PostCompletion',
];

export const CHAPTER_ORDER = ALL_GAME_CHAPTERS;

export interface ChapterDefinition {
  readonly id: GameChapter;
  readonly displayName: string;
  readonly summary: string;
  readonly primaryObjectiveId: string;
  readonly allowedNextChapters: readonly GameChapter[];
}

export const CHAPTER_DEFINITIONS: Readonly<Record<GameChapter, ChapterDefinition>> = {
  Arrival: {
    id: 'Arrival',
    displayName: 'The Approach',
    summary: 'Arrive at the mountain road leading to the abandoned Northern Relay Station.',
    primaryObjectiveId: 'obj-reach-station',
    allowedNextChapters: ['CompoundEntry'],
  },
  CompoundEntry: {
    id: 'CompoundEntry',
    displayName: 'Perimeter Breach',
    summary: 'Find a way past the locked perimeter gate into the facility compound.',
    primaryObjectiveId: 'obj-enter-compound',
    allowedNextChapters: ['FacilityInvestigation'],
  },
  FacilityInvestigation: {
    id: 'FacilityInvestigation',
    displayName: 'Silent Facility',
    summary: 'Investigate the dead control building and discover the primary power outage.',
    primaryObjectiveId: 'obj-investigate-facility',
    allowedNextChapters: ['PowerRestoration'],
  },
  PowerRestoration: {
    id: 'PowerRestoration',
    displayName: 'Primary Power',
    summary: 'Access the generator hall, restore unit G-2, and route power to the control room.',
    primaryObjectiveId: 'obj-restore-power',
    allowedNextChapters: ['SignalDiscovery'],
  },
  SignalDiscovery: {
    id: 'SignalDiscovery',
    displayName: 'The Signal',
    summary:
      'Operate receiver unit R-2, tune the anomalous frequency, and isolate the transmission.',
    primaryObjectiveId: 'obj-isolate-transmission',
    allowedNextChapters: ['SourceAnalysis'],
  },
  SourceAnalysis: {
    id: 'SourceAnalysis',
    displayName: 'The Loop',
    summary:
      'Align rooftop antenna arrays, correct the waveguide route, and determine signal origin.',
    primaryObjectiveId: 'obj-determine-source',
    allowedNextChapters: ['ThreatAftermath'],
  },
  ThreatAftermath: {
    id: 'ThreatAftermath',
    displayName: 'The Presence',
    summary:
      'Survive the disturbance sequence and avoid the anomalous presence in the control building.',
    primaryObjectiveId: 'obj-avoid-presence',
    allowedNextChapters: ['FinalDecision'],
  },
  FinalDecision: {
    id: 'FinalDecision',
    displayName: 'Final Decision',
    summary:
      'Access the primary control console and decide the fate of the signal transmission loop.',
    primaryObjectiveId: 'obj-final-decision',
    allowedNextChapters: ['Ending'],
  },
  Ending: {
    id: 'Ending',
    displayName: 'Resolution',
    summary: 'The chosen sequence executes across the facility systems.',
    primaryObjectiveId: 'obj-final-decision',
    allowedNextChapters: ['PostCompletion'],
  },
  PostCompletion: {
    id: 'PostCompletion',
    displayName: 'Station Logged',
    summary: 'The outcome has settled. Review findings, restart, or continue exploration.',
    primaryObjectiveId: 'obj-final-decision',
    allowedNextChapters: ['Arrival'], // Can restart to Arrival
  },
};

export function canTransitionChapter(from: GameChapter, to: GameChapter): boolean {
  if (from === to) return false;
  return CHAPTER_DEFINITIONS[from].allowedNextChapters.includes(to);
}

export function assertChapterTransition(from: GameChapter, to: GameChapter): void {
  if (!canTransitionChapter(from, to)) {
    throw new Error(`Illegal chapter transition: ${from} -> ${to}`);
  }
}
