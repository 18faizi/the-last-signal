/**
 * Document definitions for the facility greybox scene.
 *
 * PROVISIONAL DEVELOPMENT CONTENT — all documents are placeholder narrative
 * for the greybox milestone. Final text will be revised in a content pass.
 */
import type { DocumentDefinition } from '../../game/interaction/documents/DocumentDefinition';

export const FACILITY_DOCUMENTS: readonly DocumentDefinition[] = [
  {
    id: 'doc-facility-entry-log',
    title: 'FACILITY ENTRY LOG — FINAL SHIFT',
    date: '14 November',
    author: 'Security Post, Perimeter Gate',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Station personnel have been instructed to clear the compound by 1800 hours on the orders of the regional coordinator. Reason given: scheduled maintenance shutdown. Duration: indefinite.',
      },
      {
        kind: 'paragraph',
        text: 'I have logged all departures. The last authorised vehicle left at 17:42. I was told to leave the gate key in the security booth locker and hand the log to the courier from the ministry. No courier came.',
      },
      {
        kind: 'paragraph',
        text: 'The control building lights were still on when I left. I do not know who was in there. Nobody signed out after 16:00. If you are reading this and looking for answers, start at the control building.',
      },
      {
        kind: 'list',
        items: [
          'Gate key: left in booth locker, top drawer',
          'Generator: left running on automatic',
          'Control building: lights on, reason unknown',
          'Courier never arrived',
        ],
      },
    ],
  },
  {
    id: 'doc-generator-maintenance-sheet',
    title: 'GENERATOR MAINTENANCE RECORD — UNIT G-2',
    date: '09 November',
    author: 'A. Farooq, Facilities',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Routine service completed on generator unit G-2. Fuel levels checked and topped off; coolant loop inspected and flushed. No faults found. Unit G-1 remains offline pending parts from the depot.',
      },
      {
        kind: 'paragraph',
        text: 'Note: the maintenance tunnel access from this building requires the facility maintenance card. The card was last seen in the upper locker of the maintenance bay, left side. If it is not there, check with the night supervisor.',
      },
      {
        kind: 'paragraph',
        text: 'The tunnel route goes directly under the courtyard to the control building basement. It is the fastest way between the two buildings in poor weather. The crouch bypass near junction C4 is the only route if the main tunnel hatch is jammed.',
      },
      { kind: 'mono', lines: ['G-2 hours: 14,224', 'Next service: 15,000 hrs or 90 days'] },
    ],
  },
  {
    id: 'doc-staff-shift-note',
    title: 'SHIFT HANDOVER NOTE',
    date: '13 November',
    author: 'R. Hussain',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Leaving this under the kitchen tin because nobody checks the board anymore. If Kamal is reading this: the supervisor has not left his office since yesterday morning. His door is locked. He had the key on him.',
      },
      {
        kind: 'paragraph',
        text: "I checked the supervisor's schedule. He was supposed to be in a coordination call at 09:00 but the line never connected. His office looks out over the control building — if anyone needs to know what he saw, that is the window to look through.",
      },
      {
        kind: 'paragraph',
        text: 'The supervisor key is in the storage room. He left a spare there last month when he lost the original. Storage is at the end of the east corridor.',
      },
    ],
  },
  {
    id: 'doc-antenna-access-memo',
    title: 'ROOFTOP ACCESS AUTHORISATION MEMO',
    date: '01 November',
    author: 'Station Supervisor',
    blocks: [
      {
        kind: 'heading',
        text: 'RE: Antenna Deck Access Restrictions',
      },
      {
        kind: 'paragraph',
        text: 'Effective immediately, access to the antenna deck is restricted to authorised personnel only. The rooftop door now requires the antenna access card held at the duty station.',
      },
      {
        kind: 'paragraph',
        text: 'I am keeping the antenna access card in this office for now. If you are reading this and need to reach the antenna deck, you will find the card on my desk. Do not go up there without reading the safety briefing first.',
      },
      {
        kind: 'paragraph',
        text: 'The relay room on the antenna deck requires both the access card and an override seal — these seals are single-use and are stored in the generator building. Take one if you need to enter the relay room for maintenance.',
      },
      {
        kind: 'list',
        items: [
          'Antenna access card: supervisor office desk',
          'Override seals: generator building, electrical annex cabinet',
          'Relay room: card + seal required',
          'Do not leave the relay room hatch open',
        ],
      },
    ],
  },
  {
    id: 'doc-archive-report',
    title: 'SIGNAL ANOMALY REPORT — PROVISIONAL',
    date: '05 November',
    author: 'Communications Section',
    blocks: [
      {
        kind: 'heading',
        text: 'PROVISIONAL — NOT FOR DISTRIBUTION',
      },
      {
        kind: 'paragraph',
        text: 'This report documents anomalous signal activity recorded on the facility receiving equipment between 28 October and 04 November. The contents are preliminary and have not been reviewed by the regional coordinator.',
      },
      {
        kind: 'paragraph',
        text: 'Receiver unit R-2 has logged eleven instances of structured carrier signal on frequencies not allocated to any known transmitter in the regional plan. The signals are not atmospheric scatter. They originate from a bearing consistent with the northern ridge.',
      },
      {
        kind: 'paragraph',
        text: 'Pattern analysis indicates regular transmission intervals of approximately forty-seven minutes. The signal exhibits internal structure that does not match any known modulation standard in the facility reference library.',
      },
      {
        kind: 'paragraph',
        text: 'Recommendation: formal report to regional coordinator with full recording logs attached. Pending supervisor approval. This document is placed in the archive as an interim record only.',
      },
      {
        kind: 'mono',
        lines: [
          'Bearing: 017° (north-northeast)',
          'Interval: ~47 min',
          'Instances recorded: 11',
          'Status: PROVISIONAL / UNREVIEWED',
        ],
      },
    ],
  },
  {
    id: 'doc-transmission-first-anomalous',
    title: 'DECODED TRANSMISSION — CHANNEL 3 (PROVISIONAL)',
    date: 'UNDATED',
    author: 'Auto-Transcription, Field Receiver R-2',
    blocks: [
      {
        kind: 'heading',
        text: 'PROVISIONAL DECODE — UNVERIFIED',
      },
      {
        kind: 'paragraph',
        text: 'Carrier locked. Decode confidence acceptable. Transcription follows, reproduced verbatim including apparent transmission artifacts.',
      },
      {
        kind: 'mono',
        lines: [
          '...repeating from mark. do not restore the rooftop array. do not',
          'restore the rooftop array. the interval was never forty-seven',
          'minutes, it was counting down. timestamp received: 04 November,',
          '0347 — logged reception three days before this transmission was',
          'sent. verify equipment fault before further action...',
        ],
      },
      {
        kind: 'paragraph',
        text: 'Note appended by receiving operator: the embedded timestamp precedes the recorded reception time, which is not possible for a real transmission and strongly suggests equipment fault or transcription error. Flagged for engineering review; do not treat as reliable pending verification.',
      },
    ],
  },
];
