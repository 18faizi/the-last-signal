/**
 * Authored threat data for the facility scene (Milestone 0.9).
 *
 * One threat, one small nav graph confined to the control building
 * (upper relay corridor, stairwell, control-room side corridor, lobby
 * doorway boundary), four hiding spots, two safe zones and four
 * manifestations. Every coordinate is grounded in buildControlBuilding.ts's
 * geometry (building x ∈ [-10, 10], z ∈ [12, 27]; floor 0 walk y ≈ 0.1,
 * floor 1 walk y ≈ 3.1).
 */
import type { ThreatDefinition } from '../../../game/threat/ThreatDefinition';
import type { ThreatNavGraph } from '../../../game/threat/behavior/ThreatSearchPattern';
import type { HidingSpotDefinition } from '../../../game/threat/stealth/HidingSpotDefinition';
import type { SafeZoneDefinition } from '../../../game/threat/stealth/SafeZoneDefinition';
import type { ManifestationDefinition } from '../../../game/threat/manifestation/ManifestationDefinition';

export const THREAT_ID = 'fg-threat-presence';
export const ENCOUNTER_FIRST_CONTACT_ID = 'fg-encounter-first-contact';

// ----- nav graph -----------------------------------------------------------

export const TNODE_RELAY_EAST = 'fg-tnode-relay-east';
export const TNODE_RELAY_MID = 'fg-tnode-relay-mid';
export const TNODE_STAIR_TOP = 'fg-tnode-stair-top';
export const TNODE_STAIR_BOTTOM = 'fg-tnode-stair-bottom';
export const TNODE_CTRL_WEST = 'fg-tnode-ctrl-west';
export const TNODE_CTRL_MID = 'fg-tnode-ctrl-mid';
export const TNODE_CTRL_DESK = 'fg-tnode-ctrl-desk';
export const TNODE_CTRL_SOUTH = 'fg-tnode-ctrl-south';

/**
 * Search priorities are authored so a sweep from the control room prefers
 * the room interior (desk / mid / west) before the stairwell and upper
 * floor — deterministic ordering is priority desc, then distance to the
 * last-known position, then id.
 */
export const FACILITY_THREAT_GRAPH: ThreatNavGraph = {
  nodes: [
    {
      id: TNODE_RELAY_EAST,
      position: { x: 4, y: 3.1, z: 23 },
      adjacency: [TNODE_RELAY_MID],
      zoneId: 'fg-zone-relay-room',
      searchPriority: 1,
      visibility: 'open',
    },
    {
      id: TNODE_RELAY_MID,
      position: { x: 0, y: 3.1, z: 23 },
      adjacency: [TNODE_RELAY_EAST, TNODE_STAIR_TOP],
      zoneId: 'fg-zone-relay-room',
      searchPriority: 2,
      visibility: 'open',
    },
    {
      id: TNODE_STAIR_TOP,
      position: { x: -7, y: 3.1, z: 25.6 },
      adjacency: [TNODE_RELAY_MID, TNODE_STAIR_BOTTOM],
      zoneId: 'fg-zone-stairwell',
      searchPriority: 3,
      visibility: 'obscured',
    },
    {
      id: TNODE_STAIR_BOTTOM,
      position: { x: -7, y: 0.1, z: 24 },
      adjacency: [TNODE_STAIR_TOP, TNODE_CTRL_WEST],
      zoneId: 'fg-zone-control-room',
      searchPriority: 4,
      visibility: 'obscured',
    },
    {
      id: TNODE_CTRL_WEST,
      position: { x: -7, y: 0.1, z: 20 },
      adjacency: [TNODE_STAIR_BOTTOM, TNODE_CTRL_MID],
      zoneId: 'fg-zone-control-room',
      searchPriority: 6,
      visibility: 'open',
    },
    {
      id: TNODE_CTRL_MID,
      position: { x: -2, y: 0.1, z: 20 },
      adjacency: [TNODE_CTRL_WEST, TNODE_CTRL_DESK, TNODE_CTRL_SOUTH],
      zoneId: 'fg-zone-control-room',
      searchPriority: 7,
      visibility: 'open',
    },
    {
      id: TNODE_CTRL_DESK,
      position: { x: -4, y: 0.1, z: 17.5 },
      adjacency: [TNODE_CTRL_MID],
      zoneId: 'fg-zone-control-room',
      searchPriority: 8,
      visibility: 'open',
    },
    {
      id: TNODE_CTRL_SOUTH,
      position: { x: 0, y: 0.1, z: 16.6 },
      adjacency: [TNODE_CTRL_MID],
      zoneId: 'fg-zone-control-room',
      searchPriority: 5,
      visibility: 'open',
      // The lobby doorway is the safe-zone boundary: the threat can reach
      // this node but never crosses into the lobby safe zone beyond it.
    },
  ],
};

// ----- safe zones ----------------------------------------------------------

export const SAFEZONE_CONTROL_LOBBY = 'fg-safezone-control-lobby';
export const SAFEZONE_SECURITY_BOOTH = 'fg-safezone-security-booth';

export const FACILITY_SAFE_ZONES: readonly SafeZoneDefinition[] = [
  {
    id: SAFEZONE_CONTROL_LOBBY,
    displayName: 'Control Lobby',
    // The lobby south of the control-room divider (z < 16): the authored
    // encounter endpoint the pursued player retreats to.
    aabb: { minX: -10, minY: -1, minZ: 11, maxX: 10, maxY: 4, maxZ: 16 },
    resolvesEncounterIds: [ENCOUNTER_FIRST_CONTACT_ID],
    threatEnterable: false,
    detectionDecays: true,
    checkpointId: 'fg-cp-control-lobby',
  },
  {
    id: SAFEZONE_SECURITY_BOOTH,
    displayName: 'Security Booth',
    aabb: { minX: -21, minY: -1, minZ: 2, maxX: -12, maxY: 5, maxZ: 11 },
    resolvesEncounterIds: [],
    threatEnterable: false,
    detectionDecays: true,
  },
];

// ----- threat definition ---------------------------------------------------

/**
 * Speeds: player walk = 3.2 m/s, sprint = 5.4 m/s (PlayerConfig). The
 * threat's pursuit speed (4.2) sits deliberately between them: it closes on
 * a walking player but never outruns a sprint.
 */
export const FACILITY_THREAT_DEFINITION: ThreatDefinition = {
  id: THREAT_ID,
  displayName: 'Unknown Presence',
  vision: {
    maxViewDistance: 18,
    horizontalFovDeg: 120,
    verticalToleranceMeters: 2.2,
    falloffStartDistance: 6,
    sprintMultiplier: 1.0,
    walkMultiplier: 0.7,
    crouchMultiplier: 0.35,
    peripheralPenalty: 0.45,
    behindMultiplier: 0,
  },
  suspicion: {
    suspicionGainPerSecond: 0.55,
    suspicionDecayPerSecond: 0.12,
    suspiciousThreshold: 0.3,
    investigateThreshold: 0.7,
    relaxThreshold: 0.12,
    detectionGainPerSecond: 0.65,
    detectionDecayPerSecond: 0.25,
    detectionDecayAfterLosBreakPerSecond: 0.08,
    detectionVisionFloor: 0.35,
  },
  movement: {
    moveSpeed: 2.2,
    pursuitSpeed: 4.2,
    investigationPauseSeconds: 3.0,
    searchNodePauseSeconds: 1.6,
    searchTimeoutSeconds: 26,
    pursuitLosLossSeconds: 3.5,
    captureRadius: 1.1,
  },
  homeNodeId: TNODE_RELAY_EAST,
  allowedZoneIds: ['fg-zone-relay-room', 'fg-zone-stairwell', 'fg-zone-control-room'],
  safeZoneIds: [SAFEZONE_CONTROL_LOBBY, SAFEZONE_SECURITY_BOOTH],
};

// ----- hiding spots --------------------------------------------------------

export const HIDE_CABINET_RELAY = 'fg-hide-cabinet-relay';
export const HIDE_LOCKER_STAIRWELL = 'fg-hide-locker-stairwell';
export const HIDE_UNDER_DESK = 'fg-hide-under-desk';
export const HIDE_ALCOVE_RELAY = 'fg-hide-alcove-relay';

export const FACILITY_HIDING_SPOTS: readonly HidingSpotDefinition[] = [
  {
    id: HIDE_CABINET_RELAY,
    kind: 'equipment-cabinet',
    displayName: 'EQUIPMENT CABINET',
    zoneId: 'fg-zone-relay-room',
    entryPosition: { x: 7.2, y: 3.1, z: 24 },
    colliderPosition: { x: 8.6, y: 3.1, z: 24 },
    cameraPosition: { x: 8.6, y: 4.55, z: 24 },
    exitPosition: { x: 7.2, y: 3.1, z: 24 },
    facingYaw: -Math.PI / 2, // looking west, out of the cabinet
    lookYawLimit: 0.35,
    concealment: 1,
    fullyHiding: true,
    inspectable: true,
    interactionDistance: 2.4,
  },
  {
    id: HIDE_LOCKER_STAIRWELL,
    kind: 'locker',
    displayName: 'MAINTENANCE LOCKER',
    zoneId: 'fg-zone-control-room',
    entryPosition: { x: -8.4, y: 0.1, z: 22.5 },
    colliderPosition: { x: -9.25, y: 0.1, z: 22.5 },
    cameraPosition: { x: -9.25, y: 1.55, z: 22.5 },
    exitPosition: { x: -8.4, y: 0.1, z: 22.5 },
    facingYaw: Math.PI / 2, // looking east into the control room
    lookYawLimit: 0.35,
    concealment: 1,
    fullyHiding: true,
    inspectable: true,
    interactionDistance: 2.4,
  },
  {
    id: HIDE_UNDER_DESK,
    kind: 'under-desk',
    displayName: 'UNDER THE COMMS DESK',
    zoneId: 'fg-zone-control-room',
    entryPosition: { x: -4, y: 0.1, z: 19 },
    colliderPosition: { x: -4, y: 0.1, z: 18.2 },
    cameraPosition: { x: -4, y: 0.55, z: 18.2 },
    exitPosition: { x: -4, y: 0.1, z: 19.2 },
    facingYaw: 0, // looking north from under the desk
    lookYawLimit: 0.6,
    concealment: 0.85,
    fullyHiding: false,
    inspectable: true,
    interactionDistance: 2.2,
  },
  {
    id: HIDE_ALCOVE_RELAY,
    kind: 'dark-alcove',
    displayName: 'DARK ALCOVE',
    zoneId: 'fg-zone-relay-room',
    entryPosition: { x: -8.2, y: 3.1, z: 18.6 },
    colliderPosition: { x: -9.0, y: 3.1, z: 18.6 },
    cameraPosition: { x: -9.0, y: 4.6, z: 18.6 },
    exitPosition: { x: -8.2, y: 3.1, z: 18.6 },
    facingYaw: Math.PI / 2, // looking east along the relay corridor
    lookYawLimit: 0.8,
    concealment: 0.9,
    fullyHiding: false,
    inspectable: false,
    interactionDistance: 2.4,
  },
];

// ----- manifestations ------------------------------------------------------

export const MANIFEST_STAIRWELL_SILHOUETTE = 'fg-manifest-stairwell-silhouette';
export const MANIFEST_DOORWAY_CROSSING = 'fg-manifest-doorway-crossing';
export const MANIFEST_CORRIDOR_LIGHT = 'fg-manifest-corridor-light';
export const MANIFEST_LOBBY_PHONE = 'fg-manifest-lobby-phone';

export const FACILITY_MANIFESTATIONS: readonly ManifestationDefinition[] = [
  {
    // Event A: a distant, brief silhouette at the stairwell top, visible
    // from the relay level as the player returns from the rooftop.
    id: MANIFEST_STAIRWELL_SILHOUETTE,
    type: 'distant-silhouette',
    position: { x: -7, y: 3.1, z: 25.4 },
    facingYaw: Math.PI, // facing south, toward the approaching player
    durationSeconds: 6,
    endsWhenObstructed: true,
  },
  {
    // Event B: a presence crossing the far end of the control room.
    id: MANIFEST_DOORWAY_CROSSING,
    type: 'moving-presence',
    position: { x: -6, y: 0.1, z: 25 },
    facingYaw: Math.PI / 2,
    durationSeconds: 9,
    moveTo: { x: 3, y: 0.1, z: 25 },
    moveSpeed: 1.6,
  },
  {
    // Event B: corridor light disturbance (indirect/mechanical).
    id: MANIFEST_CORRIDOR_LIGHT,
    type: 'mechanical-disturbance',
    position: { x: -4, y: 2.8, z: 20 },
    facingYaw: 0,
    durationSeconds: 4,
    disturbance: 'light',
    disturbanceTargetId: 'fg-light-ctrl-corridor',
  },
  {
    // Event B: the lobby duty phone indicator blinking (placeholder).
    id: MANIFEST_LOBBY_PHONE,
    type: 'mechanical-disturbance',
    position: { x: 3, y: 1.05, z: 17.3 },
    facingYaw: 0,
    durationSeconds: 5,
    disturbance: 'phone-indicator',
    disturbanceTargetId: 'fg-phone-duty-desk',
  },
];

// ----- authored light fixtures --------------------------------------------

export const LIGHT_ROOFTOP_WARNING = 'fg-light-rooftop-warning';
export const LIGHT_CTRL_CORRIDOR = 'fg-light-ctrl-corridor';
export const PHONE_DUTY_DESK = 'fg-phone-duty-desk';

export interface ThreatLightFixtureDefinition {
  readonly id: string;
  readonly position: { x: number; y: number; z: number };
  readonly color: { r: number; g: number; b: number };
  /** True: starts lit (mode 'on'). */
  readonly initiallyOn: boolean;
}

export const FACILITY_THREAT_FIXTURES: readonly ThreatLightFixtureDefinition[] = [
  {
    id: LIGHT_ROOFTOP_WARNING,
    position: { x: -2, y: 7.3, z: 18.5 },
    color: { r: 0.9, g: 0.25, b: 0.2 },
    initiallyOn: false,
  },
  {
    id: LIGHT_CTRL_CORRIDOR,
    position: { x: -4, y: 2.85, z: 20.5 },
    color: { r: 0.85, g: 0.9, b: 0.8 },
    initiallyOn: true,
  },
  {
    id: PHONE_DUTY_DESK,
    position: { x: 3, y: 1.05, z: 17.3 },
    color: { r: 0.2, g: 0.7, b: 0.3 },
    initiallyOn: false,
  },
];

// ----- encounter checkpoint ------------------------------------------------

export const CHECKPOINT_ENCOUNTER_START = 'fg-cp-encounter-start';
