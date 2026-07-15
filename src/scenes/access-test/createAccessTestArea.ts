/**
 * Builds the AccessTestScene grey-box layout.
 *
 * Five corridors, each with a locked door and the key/card/tool needed
 * to open it. The player spawns in a central lobby and can walk to each
 * corridor to pick up an item and test the unlock loop.
 *
 * Layout (top view, Z forward):
 *
 *        [pickup A]──[door A]──[Area A]
 *        [pickup B]──[door B]──[Area B]
 *  SPAWN [pickup C]──[door C]──[Area C]
 *        [pickup D]──[door D]──[Area D]  (AnyOf: key A or card B)
 *        [wrong key] [door E]──[Area E]  (AllOf: key A + card B)
 *
 * Pickup D uses the wrong-key pickup to demonstrate access-denied feedback.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { InventoryService } from '../../game/inventory/InventoryService';
import type { InventoryRegistry } from '../../game/inventory/InventoryRegistry';
import type { InteractionRegistry } from '../../game/interaction/InteractionRegistry';
import { DoorController } from '../../game/doors/DoorController';
import { DoorInteractionTarget } from '../../game/doors/DoorInteractionTarget';
import type { DoorRegistry } from '../../game/doors/DoorRegistry';
import { createPickup } from '../../game/pickups/PickupController';
import type { PickupRegistry } from '../../game/pickups/PickupRegistry';
import { CourseBuilder, COURSE_COLORS } from '../movement-test/CourseBuilder';
import {
  ITEM_DEFS,
  PICKUP_DEFS,
  LOCK_A,
  LOCK_B,
  LOCK_C,
  LOCK_D,
  LOCK_E,
} from './accessTestDefinitions';

// Vertical arrangement: 5 corridors, each 4 units wide, Z offset by 4 each.
const CORRIDOR_ROWS = [
  { label: 'AREA A', zOffset: 8, lockDef: LOCK_A, pickupId: 'at-pickup-maintenance-key' },
  { label: 'AREA B', zOffset: 4, lockDef: LOCK_B, pickupId: 'at-pickup-security-card' },
  { label: 'AREA C', zOffset: 0, lockDef: LOCK_C, pickupId: 'at-pickup-bypass-tool' },
  { label: 'AREA D', zOffset: -4, lockDef: LOCK_D, pickupId: null },
  { label: 'AREA E', zOffset: -8, lockDef: LOCK_E, pickupId: null },
];

export interface AccessTestAreaResult {
  builder: CourseBuilder;
}

export function createAccessTestArea(
  scene: Scene,
  interactionRegistry: InteractionRegistry,
  inventory: InventoryService,
  itemRegistry: InventoryRegistry,
  doorRegistry: DoorRegistry,
  pickupRegistry: PickupRegistry,
): AccessTestAreaResult {
  const builder = new CourseBuilder(scene);

  // Register item definitions.
  for (const def of ITEM_DEFS) {
    if (!itemRegistry.has(def.id)) {
      itemRegistry.register(def);
    }
  }

  // Central lobby floor.
  builder.box('lobby-floor', {
    width: 24,
    height: 0.5,
    depth: 26,
    position: new Vector3(0, -0.25, 0),
    color: COURSE_COLORS.ground,
  });

  // Outer walls.
  builder.box('wall-north', {
    width: 24,
    height: 3,
    depth: 0.4,
    position: new Vector3(0, 1.5, 13.2),
    color: COURSE_COLORS.wall,
  });
  builder.box('wall-south', {
    width: 24,
    height: 3,
    depth: 0.4,
    position: new Vector3(0, 1.5, -13.2),
    color: COURSE_COLORS.wall,
  });
  builder.box('wall-west', {
    width: 0.4,
    height: 3,
    depth: 26,
    position: new Vector3(-12.2, 1.5, 0),
    color: COURSE_COLORS.wall,
  });
  builder.box('wall-east', {
    width: 0.4,
    height: 3,
    depth: 26,
    position: new Vector3(12.2, 1.5, 0),
    color: COURSE_COLORS.wall,
  });

  // Pickup shelf along west wall.
  builder.box('pickup-shelf', {
    width: 1.4,
    height: 0.8,
    depth: 22,
    position: new Vector3(-10, 0.4, 0),
    color: COURSE_COLORS.step,
  });

  // Per-corridor: divider walls, door frames, labels, pickups, doors.
  for (const [i, row] of CORRIDOR_ROWS.entries()) {
    const z = row.zOffset;

    // Divider wall between corridors (skip first/last pairs).
    if (i < CORRIDOR_ROWS.length - 1) {
      builder.box(`div-${i}`, {
        width: 8,
        height: 3,
        depth: 0.2,
        position: new Vector3(4, 1.5, z - 2),
        color: COURSE_COLORS.wall,
      });
    }

    // Door frame at x=2, z=row.zOffset.
    const doorPos = new Vector3(2, 1.15, z);
    const doorController = new DoorController(
      {
        id: `at-door-${row.label.toLowerCase().replace(' ', '-')}`,
        label: row.label,
        motionConfig: { motionType: 'hinged', width: 1.0, height: 2.3 },
        lock: row.lockDef,
        autoCloseSeconds: 5,
        speedMultiplier: 1.2,
      },
      doorPos,
      scene,
      inventory,
      itemRegistry,
    );
    doorRegistry.register(doorController);
    const doorTarget = new DoorInteractionTarget(doorController, scene);
    interactionRegistry.register(doorTarget);

    // Area label above door.
    builder.label(row.label, new Vector3(2, 2.8, z), 1.8);

    // Pickup on the shelf for areas A, B, C only.
    if (row.pickupId !== null) {
      const pickupDef = PICKUP_DEFS.find((p) => p.id === row.pickupId);
      if (pickupDef !== undefined) {
        const pickupPos = new Vector3(-9.6, 1.1, z);
        const pickupTarget = createPickup(
          pickupDef,
          pickupPos,
          scene,
          inventory,
          interactionRegistry,
        );
        pickupRegistry.register(pickupTarget);
      }
    }
  }

  // Wrong key pickup for testing access-denied.
  const wrongKeyDef = PICKUP_DEFS.find((p) => p.id === 'at-pickup-wrong-key');
  if (wrongKeyDef !== undefined) {
    const wrongKeyTarget = createPickup(
      wrongKeyDef,
      new Vector3(-9.6, 1.1, -4),
      scene,
      inventory,
      interactionRegistry,
    );
    pickupRegistry.register(wrongKeyTarget);
  }

  // Another bypass tool pickup (for testing consume-one repeat).
  const bypassDef2 = PICKUP_DEFS.find((p) => p.id === 'at-pickup-bypass-tool');
  if (bypassDef2 !== undefined) {
    const bypassDef2copy = { ...bypassDef2, id: 'at-pickup-bypass-tool-2' };
    const bypassTarget2 = createPickup(
      bypassDef2copy,
      new Vector3(-9.6, 1.1, 1.5),
      scene,
      inventory,
      interactionRegistry,
    );
    pickupRegistry.register(bypassTarget2);
  }

  // Scene labels.
  builder.label('PICKUP SHELF', new Vector3(-9.6, 2.4, 0), 2.0);
  builder.label('DOORS →', new Vector3(-1, 2.4, 0), 1.6);

  return { builder };
}
