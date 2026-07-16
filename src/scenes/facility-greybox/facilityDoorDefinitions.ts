/**
 * Door and lock definitions for the facility greybox scene.
 *
 * All lock ids are prefixed 'fg-lock-' and door ids 'fg-door-'.
 * Access requirements use the helper constructors from AccessRequirement.ts
 * so the AccessEvaluator can process them correctly.
 */
import type { DoorDefinition } from '../../game/doors/DoorDefinition';
import type { LockDefinition } from '../../game/access/LockDefinition';
import { requireItem, requirePower, anyOf, allOf } from '../../game/access/AccessRequirement';
import { CIRCUIT_TUNNEL_ID } from './power/facilityPowerDefinitions';

// ----- Lock definitions --------------------------------------------------

export const LOCK_COMPOUND_GATE: LockDefinition = {
  id: 'fg-lock-compound-gate',
  requirement: requireItem('fg-compound-gate-key'),
  lockedReason: 'REQUIRES COMPOUND GATE KEY',
};

export const LOCK_GENERATOR: LockDefinition = {
  id: 'fg-lock-generator',
  requirement: requireItem('fg-generator-key'),
  lockedReason: 'REQUIRES GENERATOR KEY',
};

/**
 * Combined inventory+power access (spec section 23 demonstration): the
 * tunnel maintenance door's actuator is on the tunnel circuit, so it needs
 * both the maintenance card AND the tunnel circuit energized. DoorController
 * stays fully generic — this is just another AllOf requirement tree fed to
 * the same AccessEvaluator every other lock uses.
 */
export const LOCK_TUNNEL_MAINTENANCE: LockDefinition = {
  id: 'fg-lock-tunnel-maintenance',
  requirement: allOf(
    requireItem('fg-maintenance-card'),
    requirePower(CIRCUIT_TUNNEL_ID, { poweredReason: 'TUNNEL CIRCUIT NOT ENERGIZED' }),
  ),
  lockedReason: 'REQUIRES MAINTENANCE CARD AND TUNNEL POWER',
};

/** AnyOf: maintenance card OR compound gate key (master-key scenario). */
export const LOCK_TUNNEL_SHORTCUT: LockDefinition = {
  id: 'fg-lock-tunnel-shortcut',
  requirement: anyOf(requireItem('fg-maintenance-card'), requireItem('fg-compound-gate-key')),
  lockedReason: 'REQUIRES MAINTENANCE CARD OR GATE KEY',
};

export const LOCK_ARCHIVE: LockDefinition = {
  id: 'fg-lock-archive',
  requirement: requireItem('fg-archive-key'),
  lockedReason: 'REQUIRES ARCHIVE KEY',
};

export const LOCK_SUPERVISOR: LockDefinition = {
  id: 'fg-lock-supervisor',
  requirement: requireItem('fg-supervisor-key'),
  lockedReason: 'REQUIRES SUPERVISOR KEY',
};

export const LOCK_ROOFTOP: LockDefinition = {
  id: 'fg-lock-rooftop',
  requirement: requireItem('fg-antenna-access-card'),
  lockedReason: 'REQUIRES ANTENNA ACCESS CARD',
};

/** AllOf: antenna access card AND one override seal (consumed). */
export const LOCK_RELAY_ROOM: LockDefinition = {
  id: 'fg-lock-relay-room',
  requirement: allOf(
    requireItem('fg-antenna-access-card'),
    requireItem('fg-override-seal', { consumptionPolicy: 'consume-one' }),
  ),
  lockedReason: 'REQUIRES ANTENNA CARD AND OVERRIDE SEAL',
};

// ----- Door definitions --------------------------------------------------

/** Compound pedestrian gate — hinged outward, requires gate key. */
export const DOOR_DEF_COMPOUND_GATE: DoorDefinition = {
  id: 'fg-door-compound-gate',
  label: 'PEDESTRIAN GATE',
  motionConfig: { motionType: 'hinged', width: 1.0, height: 2.2 },
  lock: LOCK_COMPOUND_GATE,
  speedMultiplier: 1.5,
};

/** Control building entrance — unlocked by default, always open. */
export const DOOR_DEF_CONTROL_ENTRANCE: DoorDefinition = {
  id: 'fg-door-control-entrance',
  label: 'CONTROL BUILDING',
  motionConfig: { motionType: 'hinged', width: 1.1, height: 2.4 },
};

/** Communications archive door — optional area, requires archive key. */
export const DOOR_DEF_ARCHIVE: DoorDefinition = {
  id: 'fg-door-archive',
  label: 'COMMUNICATIONS ARCHIVE',
  motionConfig: { motionType: 'hinged', width: 1.0, height: 2.2 },
  lock: LOCK_ARCHIVE,
};

/** Generator building entrance — requires generator key. */
export const DOOR_DEF_GENERATOR: DoorDefinition = {
  id: 'fg-door-generator',
  label: 'GENERATOR BUILDING',
  motionConfig: { motionType: 'sliding', width: 1.4, height: 2.4 },
  lock: LOCK_GENERATOR,
};

/** Tunnel maintenance door from generator side. */
export const DOOR_DEF_TUNNEL_MAINTENANCE: DoorDefinition = {
  id: 'fg-door-tunnel-maintenance',
  label: 'TUNNEL ACCESS',
  motionConfig: { motionType: 'hinged', width: 0.9, height: 2.1 },
  lock: LOCK_TUNNEL_MAINTENANCE,
};

/** Control-building basement tunnel shortcut door — AnyOf lock. */
export const DOOR_DEF_TUNNEL_SHORTCUT: DoorDefinition = {
  id: 'fg-door-tunnel-shortcut',
  label: 'CONTROL BASEMENT',
  motionConfig: { motionType: 'hinged', width: 0.9, height: 2.1, hingeOnLeft: false },
  lock: LOCK_TUNNEL_SHORTCUT,
};

/** Supervisor office door — requires supervisor key. */
export const DOOR_DEF_SUPERVISOR: DoorDefinition = {
  id: 'fg-door-supervisor',
  label: "SUPERVISOR'S OFFICE",
  motionConfig: { motionType: 'hinged', width: 0.9, height: 2.2 },
  lock: LOCK_SUPERVISOR,
};

/** Rooftop antenna deck door — requires antenna access card. */
export const DOOR_DEF_ROOFTOP: DoorDefinition = {
  id: 'fg-door-rooftop',
  label: 'ANTENNA DECK',
  motionConfig: { motionType: 'sliding', width: 1.2, height: 2.2 },
  lock: LOCK_ROOFTOP,
};

/** Relay room door — AllOf: antenna card + override seal (consumed). */
export const DOOR_DEF_RELAY_ROOM: DoorDefinition = {
  id: 'fg-door-relay-room',
  label: 'RELAY ROOM',
  motionConfig: { motionType: 'hinged', width: 0.9, height: 2.1 },
  lock: LOCK_RELAY_ROOM,
};

export const ALL_DOOR_DEFS: readonly DoorDefinition[] = [
  DOOR_DEF_COMPOUND_GATE,
  DOOR_DEF_CONTROL_ENTRANCE,
  DOOR_DEF_ARCHIVE,
  DOOR_DEF_GENERATOR,
  DOOR_DEF_TUNNEL_MAINTENANCE,
  DOOR_DEF_TUNNEL_SHORTCUT,
  DOOR_DEF_SUPERVISOR,
  DOOR_DEF_ROOFTOP,
  DOOR_DEF_RELAY_ROOM,
];
