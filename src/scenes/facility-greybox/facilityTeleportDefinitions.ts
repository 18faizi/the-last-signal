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
  // ----- Milestone 0.6: power control vantage points -----------------------
  // Positioned so a level (pitch 0) look lands directly on each wall-mounted
  // control — used by tests/e2e/power.spec.ts to drive the real hold
  // interaction for the starter without a state-setting shortcut.
  {
    id: 'fg-tp-gen-status-panel',
    label: 'Generator Status Panel',
    position: { x: 43.5, y: 0.1, z: 5.2 },
    yaw: 0,
  },
  {
    id: 'fg-tp-gen-fuel-valve',
    label: 'Generator Fuel Valve',
    position: { x: 45, y: 0.1, z: 5.2 },
    yaw: 0,
  },
  {
    id: 'fg-tp-gen-battery',
    label: 'Generator Starter Battery',
    position: { x: 46, y: 0.1, z: 5.2 },
    yaw: 0,
  },
  {
    id: 'fg-tp-gen-estop',
    label: 'Generator Emergency Stop',
    position: { x: 47, y: 0.1, z: 5.2 },
    yaw: 0,
  },
  {
    id: 'fg-tp-gen-selector',
    label: 'Generator Mode Selector',
    position: { x: 48, y: 0.1, z: 5.2 },
    yaw: 0,
  },
  {
    id: 'fg-tp-gen-starter',
    label: 'Generator Starter Control',
    position: { x: 49, y: 0.1, z: 5.2 },
    yaw: 0,
  },
  {
    id: 'fg-tp-gen-breaker',
    label: 'Generator Main Breaker',
    position: { x: 50, y: 0.1, z: 5.2 },
    yaw: 0,
  },
  {
    id: 'fg-tp-distribution-panel',
    label: 'Distribution Panel',
    position: { x: -8.7, y: 0.1, z: 18 },
    yaw: -Math.PI / 2,
  },
  {
    id: 'fg-tp-receiver',
    label: 'Field Receiver',
    position: { x: -8.7, y: 0.1, z: 22 },
    yaw: -Math.PI / 2,
  },
  // ----- Milestone 0.8: antenna control vantage points ----------------------
  // Positioned so a level (pitch 0) look lands directly on each rooftop
  // control — used by tests/e2e/antenna.spec.ts to drive real interactions
  // without a state-setting shortcut, mirroring the M0.6 generator vantage
  // points above. Direction convention (see FirstPersonController.ts):
  // yaw 0 looks toward +Z, so each vantage point stands at the SAME x as its
  // target, offset slightly toward -Z, facing yaw 0 — exactly like the
  // generator control row above.
  {
    id: 'fg-tp-antenna-cabinet',
    label: 'Antenna Control Cabinet',
    position: { x: -8, y: 6.1, z: 21.3 },
    yaw: 0,
  },
  {
    id: 'fg-tp-waveguide-junction',
    label: 'Waveguide Junction Box',
    position: { x: 3, y: 6.1, z: 19.3 },
    yaw: 0,
  },
];
