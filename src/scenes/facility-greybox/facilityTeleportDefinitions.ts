/**
 * Development teleport positions for the facility greybox scene.
 *
 * Accessible from the F8 teleport menu in development builds.
 */
import type { TeleportDefinition } from '../../game/facility/TeleportDefinition';

export const FACILITY_TELEPORTS: readonly TeleportDefinition[] = [
  {
    id: 'fg-tp-approach',
    label: 'Mountain Approach (spawn)',
    position: { x: -58, y: 0.1, z: 0 },
    yaw: 0,
  },
  {
    id: 'fg-tp-gate',
    label: 'Compound Gate',
    position: { x: -17, y: 0.1, z: 0 },
    yaw: 0,
  },
  {
    id: 'fg-tp-security-booth',
    label: 'Security Booth',
    position: { x: -17, y: 0.1, z: 7 },
    yaw: Math.PI / 2,
  },
  {
    id: 'fg-tp-courtyard',
    label: 'Courtyard Centre',
    position: { x: 10, y: 0.1, z: 0 },
    yaw: 0,
  },
  {
    id: 'fg-tp-control-lobby',
    label: 'Control Building Lobby',
    position: { x: 0, y: 0.1, z: 13 },
    yaw: Math.PI,
  },
  {
    id: 'fg-tp-control-room',
    label: 'Control Room',
    position: { x: -2, y: 0.1, z: 20 },
    yaw: Math.PI,
  },
  {
    id: 'fg-tp-generator',
    label: 'Generator Building',
    position: { x: 45, y: 0.1, z: 0 },
    yaw: -Math.PI / 2,
  },
  {
    id: 'fg-tp-tunnel',
    label: 'Cable Tunnel',
    position: { x: 20, y: -2.9, z: 0 },
    yaw: -Math.PI / 2,
  },
  {
    id: 'fg-tp-staff',
    label: 'Staff Quarters',
    position: { x: 42, y: 0.1, z: -18 },
    yaw: 0,
  },
  {
    id: 'fg-tp-supervisor',
    label: "Supervisor's Office",
    position: { x: 24, y: 0.1, z: -14 },
    yaw: 0,
  },
  {
    id: 'fg-tp-rooftop',
    label: 'Rooftop Antenna Deck',
    position: { x: 0, y: 6.1, z: 22 },
    yaw: Math.PI,
  },
];
