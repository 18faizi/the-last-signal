/**
 * Checkpoint definitions for the facility greybox scene.
 *
 * Checkpoints are activated by zone entry triggers.  The player respawns at
 * the most recently activated checkpoint.
 */
import type { CheckpointDefinition } from '../../game/facility/Checkpoint';

export const FACILITY_CHECKPOINTS: readonly CheckpointDefinition[] = [
  {
    id: 'fg-cp-spawn',
    label: 'Mountain Approach',
    spawnPosition: { x: -58, y: 0.1, z: 0 },
    spawnYaw: 0, // facing +X (east)
  },
  {
    id: 'fg-cp-gate',
    label: 'Compound Gate',
    spawnPosition: { x: -15, y: 0.1, z: 0 },
    spawnYaw: 0,
  },
  {
    id: 'fg-cp-courtyard',
    label: 'Courtyard',
    spawnPosition: { x: 10, y: 0.1, z: 0 },
    spawnYaw: 0,
  },
  {
    id: 'fg-cp-control-lobby',
    label: 'Control Building',
    spawnPosition: { x: 0, y: 0.1, z: 13 },
    spawnYaw: Math.PI, // facing south into lobby
  },
  {
    id: 'fg-cp-tunnel-entrance',
    label: 'Tunnel Entrance',
    spawnPosition: { x: 38, y: -2.9, z: 0 },
    spawnYaw: -Math.PI / 2, // facing west into tunnel
  },
  {
    id: 'fg-cp-staff-quarters',
    label: 'Staff Quarters',
    spawnPosition: { x: 42, y: 0.1, z: -16 },
    spawnYaw: 0,
  },
  {
    id: 'fg-cp-supervisor',
    label: "Supervisor's Office",
    spawnPosition: { x: 24, y: 0.1, z: -14 },
    spawnYaw: 0,
  },
  {
    // Milestone 0.9: activated by the event director when the first
    // encounter begins; encounter failure returns the player here.
    id: 'fg-cp-encounter-start',
    label: 'Control Room (Encounter)',
    spawnPosition: { x: -2, y: 0.1, z: 19 },
    spawnYaw: Math.PI, // facing south toward the lobby doorway
  },
];
