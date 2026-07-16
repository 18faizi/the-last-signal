/**
 * Power source, circuit and load definitions for the facility greybox scene.
 *
 * Generator capacity (10) is deliberately smaller than the sum of every
 * circuit's cost (1 + 4 + 1 + 3 + 2 + 4 + 2 = 17), so the player must choose
 * which areas to energize — see docs/level-design/circuit-capacity-balance.md
 * for the full trade-off reasoning. The emergency battery (2 units) can only
 * ever cover the cheap emergency/security circuit before the generator
 * starts.
 */
import { asPowerSourceId } from '../../../game/power/PowerSourceId';
import { asPowerCircuitId } from '../../../game/power/PowerCircuitId';
import { asPowerLoadId } from '../../../game/power/PowerLoadId';
import type { PowerSourceDefinition } from '../../../game/power/PowerSource';
import type { PowerCircuitDefinition } from '../../../game/power/PowerCircuit';
import type { PowerLoadDefinition } from '../../../game/power/PowerLoad';

// ----- Sources -------------------------------------------------------------

export const GENERATOR_SOURCE_ID = asPowerSourceId('fg-power-src-generator');
export const BATTERY_SOURCE_ID = asPowerSourceId('fg-power-src-battery');

export const GENERATOR_SOURCE: PowerSourceDefinition = {
  id: GENERATOR_SOURCE_ID,
  kind: 'generator',
  displayName: 'Facility Generator',
  maxCapacity: 10,
  priority: 10,
};

export const BATTERY_SOURCE: PowerSourceDefinition = {
  id: BATTERY_SOURCE_ID,
  kind: 'emergency-battery',
  displayName: 'Emergency Battery',
  maxCapacity: 2,
  priority: 1,
};

export const FACILITY_POWER_SOURCES: readonly PowerSourceDefinition[] = [
  GENERATOR_SOURCE,
  BATTERY_SOURCE,
];

// ----- Circuits --------------------------------------------------------------

export const CIRCUIT_EMERGENCY_SECURITY_ID = asPowerCircuitId('fg-circuit-emergency-security');
export const CIRCUIT_CONTROL_ROOM_ID = asPowerCircuitId('fg-circuit-control-room');
export const CIRCUIT_GENERATOR_AUXILIARY_ID = asPowerCircuitId('fg-circuit-generator-auxiliary');
export const CIRCUIT_TUNNEL_ID = asPowerCircuitId('fg-circuit-tunnel');
export const CIRCUIT_STAFF_QUARTERS_ID = asPowerCircuitId('fg-circuit-staff-quarters');
export const CIRCUIT_ROOFTOP_ANTENNA_ID = asPowerCircuitId('fg-circuit-rooftop-antenna');
export const CIRCUIT_ARCHIVE_ID = asPowerCircuitId('fg-circuit-archive');

export const FACILITY_POWER_CIRCUITS: readonly PowerCircuitDefinition[] = [
  {
    id: CIRCUIT_EMERGENCY_SECURITY_ID,
    displayName: 'Emergency & Security',
    capacityCost: 1,
    priority: 10,
    description: 'Perimeter gate and emergency corridor lighting.',
    eligibleSourceIds: [BATTERY_SOURCE_ID, GENERATOR_SOURCE_ID],
    emergencyEligible: true,
  },
  {
    id: CIRCUIT_CONTROL_ROOM_ID,
    displayName: 'Control Room',
    capacityCost: 4,
    priority: 9,
    description: 'Main control room consoles, lighting and comms desk — required for the receiver.',
    eligibleSourceIds: [GENERATOR_SOURCE_ID],
    emergencyEligible: false,
  },
  {
    id: CIRCUIT_GENERATOR_AUXILIARY_ID,
    displayName: 'Generator Auxiliary',
    capacityCost: 1,
    priority: 8,
    description: 'Generator hall lighting and gauge illumination.',
    eligibleSourceIds: [GENERATOR_SOURCE_ID],
    emergencyEligible: false,
  },
  {
    id: CIRCUIT_TUNNEL_ID,
    displayName: 'Cable Tunnel',
    capacityCost: 3,
    priority: 6,
    description: 'Tunnel lighting and the tunnel maintenance door actuator.',
    eligibleSourceIds: [GENERATOR_SOURCE_ID],
    emergencyEligible: false,
  },
  {
    id: CIRCUIT_STAFF_QUARTERS_ID,
    displayName: 'Staff Quarters',
    capacityCost: 2,
    priority: 4,
    description: 'Staff dormitory and kitchen lighting.',
    eligibleSourceIds: [GENERATOR_SOURCE_ID],
    emergencyEligible: false,
  },
  {
    id: CIRCUIT_ROOFTOP_ANTENNA_ID,
    displayName: 'Rooftop / Antenna',
    capacityCost: 4,
    priority: 5,
    description: 'Rooftop antenna deck lighting and beacon.',
    eligibleSourceIds: [GENERATOR_SOURCE_ID],
    emergencyEligible: false,
  },
  {
    id: CIRCUIT_ARCHIVE_ID,
    displayName: 'Communications Archive',
    capacityCost: 2,
    priority: 3,
    description: 'Archive lighting and the archive terminal.',
    eligibleSourceIds: [GENERATOR_SOURCE_ID],
    emergencyEligible: false,
  },
];

// ----- Loads -----------------------------------------------------------------

export const LOAD_GATE_EMERGENCY_LIGHT_ID = asPowerLoadId('fg-load-gate-emergency-light');
export const LOAD_SECURITY_FLOODLIGHT_ID = asPowerLoadId('fg-load-security-floodlight');
export const LOAD_CONTROL_ROOM_LIGHTS_ID = asPowerLoadId('fg-load-control-room-lights');
export const LOAD_CONTROL_ROOM_CONSOLES_ID = asPowerLoadId('fg-load-control-room-consoles');
export const LOAD_RECEIVER_ID = asPowerLoadId('fg-load-receiver');
export const LOAD_GENERATOR_HALL_LIGHTS_ID = asPowerLoadId('fg-load-generator-hall-lights');
export const LOAD_TUNNEL_LIGHTS_ID = asPowerLoadId('fg-load-tunnel-lights');
export const LOAD_TUNNEL_DOOR_ID = asPowerLoadId('fg-load-tunnel-door');
export const LOAD_STAFF_QUARTERS_LIGHTS_ID = asPowerLoadId('fg-load-staff-quarters-lights');
export const LOAD_STAFF_KITCHEN_LIGHTS_ID = asPowerLoadId('fg-load-staff-kitchen-lights');
export const LOAD_ANTENNA_DECK_LIGHTS_ID = asPowerLoadId('fg-load-antenna-deck-lights');
export const LOAD_ANTENNA_BEACON_ID = asPowerLoadId('fg-load-antenna-beacon');
export const LOAD_ARCHIVE_LIGHTS_ID = asPowerLoadId('fg-load-archive-lights');
export const LOAD_ARCHIVE_TERMINAL_ID = asPowerLoadId('fg-load-archive-terminal');

export const FACILITY_POWER_LOADS: readonly PowerLoadDefinition[] = [
  {
    id: LOAD_GATE_EMERGENCY_LIGHT_ID,
    circuitId: CIRCUIT_EMERGENCY_SECURITY_ID,
    displayName: 'Gate Emergency Light',
  },
  {
    id: LOAD_SECURITY_FLOODLIGHT_ID,
    circuitId: CIRCUIT_EMERGENCY_SECURITY_ID,
    displayName: 'Security Floodlight',
  },
  {
    id: LOAD_CONTROL_ROOM_LIGHTS_ID,
    circuitId: CIRCUIT_CONTROL_ROOM_ID,
    displayName: 'Control Room Lights',
  },
  {
    id: LOAD_CONTROL_ROOM_CONSOLES_ID,
    circuitId: CIRCUIT_CONTROL_ROOM_ID,
    displayName: 'Control Room Consoles',
  },
  { id: LOAD_RECEIVER_ID, circuitId: CIRCUIT_CONTROL_ROOM_ID, displayName: 'Field Receiver' },
  {
    id: LOAD_GENERATOR_HALL_LIGHTS_ID,
    circuitId: CIRCUIT_GENERATOR_AUXILIARY_ID,
    displayName: 'Generator Hall Lights',
  },
  { id: LOAD_TUNNEL_LIGHTS_ID, circuitId: CIRCUIT_TUNNEL_ID, displayName: 'Tunnel Lights' },
  { id: LOAD_TUNNEL_DOOR_ID, circuitId: CIRCUIT_TUNNEL_ID, displayName: 'Tunnel Door Actuator' },
  {
    id: LOAD_STAFF_QUARTERS_LIGHTS_ID,
    circuitId: CIRCUIT_STAFF_QUARTERS_ID,
    displayName: 'Staff Quarters Lights',
  },
  {
    id: LOAD_STAFF_KITCHEN_LIGHTS_ID,
    circuitId: CIRCUIT_STAFF_QUARTERS_ID,
    displayName: 'Staff Kitchen Lights',
  },
  {
    id: LOAD_ANTENNA_DECK_LIGHTS_ID,
    circuitId: CIRCUIT_ROOFTOP_ANTENNA_ID,
    displayName: 'Antenna Deck Lights',
  },
  {
    id: LOAD_ANTENNA_BEACON_ID,
    circuitId: CIRCUIT_ROOFTOP_ANTENNA_ID,
    displayName: 'Antenna Beacon',
  },
  { id: LOAD_ARCHIVE_LIGHTS_ID, circuitId: CIRCUIT_ARCHIVE_ID, displayName: 'Archive Lights' },
  {
    id: LOAD_ARCHIVE_TERMINAL_ID,
    circuitId: CIRCUIT_ARCHIVE_ID,
    displayName: 'Archive Terminal',
  },
];
