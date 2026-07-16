/**
 * Zone AABB definitions for the facility greybox scene.
 *
 * Coordinates match the world layout in the builder files:
 *   +X = east, +Z = north, +Y = up
 *   Mountain approach extends west (negative X) of compound gate at X=0
 *   Compound compound footprint: X ∈ [0, 82], Z ∈ [-32, 32]
 *
 * Zone AABBs use generous margins so the player registers entry slightly
 * before visually crossing into the space.
 */
import type { FacilityZoneDefinition } from '../../game/facility/FacilityZone';

export const FACILITY_ZONES: readonly FacilityZoneDefinition[] = [
  // Mountain approach
  {
    id: 'fg-zone-approach',
    label: 'Mountain Approach',
    isKeyZone: true,
    aabb: { minX: -65, minY: -2, minZ: -8, maxX: -18, maxY: 6, maxZ: 8 },
  },
  // Security booth area
  {
    id: 'fg-zone-security-booth',
    label: 'Security Booth',
    isKeyZone: true,
    aabb: { minX: -21, minY: -1, minZ: 2, maxX: -12, maxY: 5, maxZ: 11 },
  },
  // Courtyard (open compound interior)
  {
    id: 'fg-zone-courtyard',
    label: 'Courtyard',
    isKeyZone: true,
    aabb: { minX: -19, minY: -1, minZ: -31, maxX: 58, maxY: 6, maxZ: 31 },
  },
  // Control building lobby
  {
    id: 'fg-zone-control-lobby',
    label: 'Control Building Lobby',
    isKeyZone: true,
    aabb: { minX: -10, minY: -1, minZ: 11, maxX: 10, maxY: 4, maxZ: 16 },
  },
  // Main control room
  {
    id: 'fg-zone-control-room',
    label: 'Main Control Room',
    isKeyZone: false,
    aabb: { minX: -10, minY: -1, minZ: 16, maxX: 6, maxY: 4, maxZ: 27 },
  },
  // Communications archive (optional)
  {
    id: 'fg-zone-archive',
    label: 'Communications Archive',
    isKeyZone: false,
    aabb: { minX: 0, minY: -1, minZ: 16, maxX: 10, maxY: 4, maxZ: 27 },
  },
  // Control stairwell
  {
    id: 'fg-zone-stairwell',
    label: 'Control Stairwell',
    isKeyZone: false,
    aabb: { minX: -10, minY: -1, minZ: 25, maxX: -4, maxY: 7, maxZ: 27 },
  },
  // Upper relay room (floor 2, optional)
  {
    id: 'fg-zone-relay-room',
    label: 'Relay Room',
    isKeyZone: false,
    aabb: { minX: -10, minY: 3, minZ: 17, maxX: 10, maxY: 7, maxZ: 26 },
  },
  // Roof corridor
  {
    id: 'fg-zone-roof-corridor',
    label: 'Roof Corridor',
    isKeyZone: false,
    aabb: { minX: -10, minY: 5, minZ: 11, maxX: 10, maxY: 8, maxZ: 17 },
  },
  // Antenna deck (completion trigger)
  {
    id: 'fg-zone-antenna-deck',
    label: 'Antenna Deck',
    isKeyZone: true,
    aabb: { minX: -10, minY: 5, minZ: 17, maxX: 10, maxY: 9, maxZ: 27 },
  },
  // Generator building hall
  {
    id: 'fg-zone-generator-hall',
    label: 'Generator Hall',
    isKeyZone: true,
    aabb: { minX: 40, minY: -1, minZ: -6, maxX: 54, maxY: 5, maxZ: 6 },
  },
  // Battery bank room
  {
    id: 'fg-zone-generator-battery',
    label: 'Battery Bank Room',
    isKeyZone: false,
    aabb: { minX: 46, minY: -1, minZ: -6, maxX: 54, maxY: 5, maxZ: 1 },
  },
  // Electrical control annex
  {
    id: 'fg-zone-generator-electrical',
    label: 'Electrical Control Annex',
    isKeyZone: false,
    aabb: { minX: 40, minY: -1, minZ: 1, maxX: 54, maxY: 5, maxZ: 6 },
  },
  // Cable tunnel main route
  {
    id: 'fg-zone-tunnel-main',
    label: 'Cable Tunnel',
    isKeyZone: true,
    aabb: { minX: -10, minY: -5, minZ: -2, maxX: 41, maxY: -1, maxZ: 2 },
  },
  // Crouch-only maintenance bypass
  {
    id: 'fg-zone-tunnel-bypass',
    label: 'Maintenance Bypass',
    isKeyZone: false,
    aabb: { minX: 18, minY: -5, minZ: -5, maxX: 24, maxY: -2, maxZ: 2 },
  },
  // Staff quarters dormitory
  {
    id: 'fg-zone-staff-dormitory',
    label: 'Staff Dormitory',
    isKeyZone: true,
    aabb: { minX: 38, minY: -1, minZ: -24, maxX: 58, maxY: 4, maxZ: -14 },
  },
  // Staff kitchen / dining
  {
    id: 'fg-zone-staff-kitchen',
    label: 'Staff Kitchen',
    isKeyZone: false,
    aabb: { minX: 38, minY: -1, minZ: -14, maxX: 50, maxY: 4, maxZ: -10 },
  },
  // Staff storage room
  {
    id: 'fg-zone-staff-storage',
    label: 'Staff Storage',
    isKeyZone: false,
    aabb: { minX: 50, minY: -1, minZ: -24, maxX: 58, maxY: 4, maxZ: -14 },
  },
  // Supervisor office
  {
    id: 'fg-zone-supervisor-office',
    label: "Supervisor's Office",
    isKeyZone: true,
    aabb: { minX: 20, minY: -1, minZ: -22, maxX: 34, maxY: 4, maxZ: -12 },
  },
];
