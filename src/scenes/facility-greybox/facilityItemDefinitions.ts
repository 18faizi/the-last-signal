/**
 * Item and pickup definitions for the facility greybox scene.
 *
 * All identifiers are prefixed 'fg-' (facility-greybox) to avoid collisions
 * if multiple scenes are ever loaded in the same session.
 *
 * PROVISIONAL DEVELOPMENT CONTENT — items and descriptions are placeholder
 * text for the greybox progression.
 */
import type { InventoryItemDefinition } from '../../game/inventory/InventoryItemDefinition';
import type { PickupDefinition } from '../../game/pickups/PickupDefinition';

// ----- Item definitions --------------------------------------------------

export const FACILITY_ITEM_DEFS: readonly InventoryItemDefinition[] = [
  {
    id: 'fg-compound-gate-key',
    displayName: 'Compound Gate Key',
    description: 'Opens the pedestrian gate in the perimeter fence.',
    category: 'key',
    consumptionPolicy: 'retain',
  },
  {
    id: 'fg-generator-key',
    displayName: 'Generator Building Key',
    description: 'Opens the generator building main entrance.',
    category: 'key',
    consumptionPolicy: 'retain',
  },
  {
    id: 'fg-maintenance-card',
    displayName: 'Maintenance Access Card',
    description: 'Authorises access to maintenance tunnel routes.',
    category: 'card',
    consumptionPolicy: 'retain',
  },
  {
    id: 'fg-archive-key',
    displayName: 'Archive Key',
    description: 'Opens the communications archive in the control building.',
    category: 'key',
    consumptionPolicy: 'retain',
  },
  {
    id: 'fg-supervisor-key',
    displayName: 'Supervisor Office Key',
    description: "Opens the supervisor's private office.",
    category: 'key',
    consumptionPolicy: 'retain',
  },
  {
    id: 'fg-antenna-access-card',
    displayName: 'Antenna Access Card',
    description: 'Grants access to the rooftop antenna deck.',
    category: 'card',
    consumptionPolicy: 'retain',
  },
  {
    id: 'fg-override-seal',
    displayName: 'Override Seal',
    description: 'Single-use authorisation seal for restricted relay room.',
    category: 'tool',
    consumptionPolicy: 'consume-one',
    maxStack: 3,
  },
];

// ----- Pickup definitions ------------------------------------------------

export const FACILITY_PICKUP_DEFS: readonly PickupDefinition[] = [
  {
    id: 'fg-pickup-compound-gate-key',
    itemId: 'fg-compound-gate-key',
    label: 'COMPOUND GATE KEY',
    mode: 'direct',
  },
  {
    id: 'fg-pickup-generator-key',
    itemId: 'fg-generator-key',
    label: 'GENERATOR KEY',
    mode: 'direct',
  },
  {
    id: 'fg-pickup-maintenance-card',
    itemId: 'fg-maintenance-card',
    label: 'MAINTENANCE CARD',
    mode: 'inspect-before-collect',
    inspectionTitle: 'Maintenance Access Card',
    inspectionDescription:
      'Facility-wide maintenance card. Authorises access to service tunnels and utility routes.',
  },
  {
    id: 'fg-pickup-archive-key',
    itemId: 'fg-archive-key',
    label: 'ARCHIVE KEY',
    mode: 'direct',
  },
  {
    id: 'fg-pickup-supervisor-key',
    itemId: 'fg-supervisor-key',
    label: 'SUPERVISOR KEY',
    mode: 'direct',
  },
  {
    id: 'fg-pickup-antenna-access-card',
    itemId: 'fg-antenna-access-card',
    label: 'ANTENNA ACCESS CARD',
    mode: 'inspect-before-collect',
    inspectionTitle: 'Antenna Deck Access Card',
    inspectionDescription:
      'Authorised personnel only. Grants access to antenna deck and rooftop relay equipment.',
  },
  {
    id: 'fg-pickup-override-seal-1',
    itemId: 'fg-override-seal',
    label: 'OVERRIDE SEAL',
    mode: 'direct',
    quantity: 1,
  },
  {
    id: 'fg-pickup-override-seal-2',
    itemId: 'fg-override-seal',
    label: 'OVERRIDE SEAL',
    mode: 'direct',
    quantity: 1,
  },
];
