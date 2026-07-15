import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { installTestBridge } from '../../game/dev/TestBridge';
import { FirstPersonController } from '../../game/player/FirstPersonController';
import { DEFAULT_PLAYER_CONFIG, validatePlayerConfig } from '../../game/player/PlayerConfig';
import type {
  SceneCreationContext,
  SceneDefinition,
  SceneHandle,
} from '../../core/scenes/SceneDefinition';
import { COURSE_COLORS, CourseBuilder } from './CourseBuilder';

const SPAWN_POSITION = new Vector3(0, 0.05, 0);
const SPAWN_YAW = 0; // facing +Z, toward the course
const GROUND_SIZE = 44;
const WALL_HEIGHT = 3;

/**
 * Milestone 0.2 grey-box traversal course.
 *
 * Utilitarian primitive geometry that exercises every controller feature:
 * ramps at three slopes, steps at three heights, a crouch tunnel, a jump
 * platform, an elevated deck with a drop, a narrow corridor, collision
 * pillars and an out-of-bounds gap that triggers the respawn system.
 */
export const movementTestSceneDefinition: SceneDefinition = {
  id: 'movement-test',

  async create(context: SceneCreationContext): Promise<SceneHandle> {
    const configProblems = validatePlayerConfig(DEFAULT_PLAYER_CONFIG);
    if (configProblems.length > 0) {
      throw new Error(`Invalid player config: ${configProblems.join('; ')}`);
    }

    const scene = new Scene(context.engine);
    scene.clearColor = new Color4(0.05, 0.06, 0.08, 1);

    const hemisphere = new HemisphericLight('course-hemi', new Vector3(0.2, 1, 0.1), scene);
    hemisphere.intensity = 0.75;
    hemisphere.groundColor = new Color3(0.12, 0.12, 0.16);
    const sun = new DirectionalLight('course-sun', new Vector3(-0.4, -1, 0.3), scene);
    sun.intensity = 0.35;

    const physicsPlugin = await context.physics.enableForScene(scene);

    const builder = new CourseBuilder(scene);
    buildCourse(builder);
    context.onPhysicsReady();

    const controller = new FirstPersonController(
      scene,
      DEFAULT_PLAYER_CONFIG,
      { position: SPAWN_POSITION, yaw: SPAWN_YAW, pitch: 0 },
      {
        input: context.input,
        settings: context.settings,
        environment: context.environment,
        canvas: context.canvas,
        overlayParent: context.overlayParent,
      },
    );
    const removeBridge = installTestBridge(controller, context.environment, context.settings);

    return {
      scene,
      markerText: 'Milestone 0.2 — Movement Ready',
      getDebugFields: () => controller.getDebugFields(),
      dispose(): void {
        removeBridge();
        controller.dispose();
        builder.dispose();
        scene.dispose();
        physicsPlugin.dispose();
      },
    };
  },
};

function buildCourse(builder: CourseBuilder): void {
  // Ground slab: top surface at y = 0.
  builder.box('ground', {
    width: GROUND_SIZE,
    height: 1,
    depth: GROUND_SIZE,
    position: new Vector3(0, -0.5, 0),
    color: COURSE_COLORS.ground,
  });

  buildPerimeter(builder);
  buildRamps(builder);
  buildSteps(builder);
  buildCrouchTunnel(builder);
  buildJumpPlatformAndDeck(builder);
  buildCorridorAndPillars(builder);
}

function buildPerimeter(builder: CourseBuilder): void {
  const half = GROUND_SIZE / 2;
  const wallY = WALL_HEIGHT / 2;
  // North, east and west walls are continuous.
  builder.box('wall-north', {
    width: GROUND_SIZE,
    height: WALL_HEIGHT,
    depth: 0.5,
    position: new Vector3(0, wallY, half - 0.25),
    color: COURSE_COLORS.wall,
  });
  builder.box('wall-east', {
    width: 0.5,
    height: WALL_HEIGHT,
    depth: GROUND_SIZE,
    position: new Vector3(half - 0.25, wallY, 0),
    color: COURSE_COLORS.wall,
  });
  builder.box('wall-west', {
    width: 0.5,
    height: WALL_HEIGHT,
    depth: GROUND_SIZE,
    position: new Vector3(-(half - 0.25), wallY, 0),
    color: COURSE_COLORS.wall,
  });
  // South wall has a 4 m gap at the centre: walking through it leaves the
  // ground slab and drops the player out of bounds (respawn test).
  const segmentWidth = (GROUND_SIZE - 4) / 2;
  builder.box('wall-south-west', {
    width: segmentWidth,
    height: WALL_HEIGHT,
    depth: 0.5,
    position: new Vector3(-(2 + segmentWidth / 2), wallY, -(half - 0.25)),
    color: COURSE_COLORS.wall,
  });
  builder.box('wall-south-east', {
    width: segmentWidth,
    height: WALL_HEIGHT,
    depth: 0.5,
    position: new Vector3(2 + segmentWidth / 2, wallY, -(half - 0.25)),
    color: COURSE_COLORS.wall,
  });
  builder.label('OUT OF BOUNDS →', new Vector3(0, 1.6, -(half - 3)));
}

function buildRamps(builder: CourseBuilder): void {
  const rampLength = 6;
  const rampSpecs: ReadonlyArray<{ name: string; angleDeg: number; x: number; color: Color3 }> = [
    { name: 'ramp-walkable', angleDeg: 15, x: -18, color: COURSE_COLORS.rampWalkable },
    { name: 'ramp-limit', angleDeg: 40, x: -13.5, color: COURSE_COLORS.rampLimit },
    { name: 'ramp-steep', angleDeg: 60, x: -9, color: COURSE_COLORS.rampSteep },
  ];
  for (const spec of rampSpecs) {
    const angle = (spec.angleDeg * Math.PI) / 180;
    // Tilted box ascending toward +Z; the lower edge is buried slightly so
    // the ground seam never reads as a step.
    builder.box(spec.name, {
      width: 3.5,
      height: 0.3,
      depth: rampLength,
      position: new Vector3(
        spec.x,
        (rampLength / 2) * Math.sin(angle) - 0.1,
        6 + (rampLength / 2) * Math.cos(angle),
      ),
      rotationX: -angle,
      color: spec.color,
    });
  }
  // Labels are staggered in height and kept narrow so the three billboards
  // never overlap from the spawn viewing area.
  builder.label('RAMP 15°', new Vector3(-18, 0.9, 4.4), 2);
  builder.label('RAMP 40°', new Vector3(-13.5, 1.7, 4.4), 2);
  builder.label('RAMP 60°', new Vector3(-9, 2.5, 4.4), 2);
}

function buildSteps(builder: CourseBuilder): void {
  const stepSpecs: ReadonlyArray<{ name: string; height: number; z: number }> = [
    { name: 'step-small', height: 0.15, z: 6 },
    { name: 'step-max', height: 0.32, z: 9 },
    { name: 'step-too-high', height: 0.6, z: 12 },
  ];
  for (const spec of stepSpecs) {
    builder.box(spec.name, {
      width: 3,
      height: spec.height,
      depth: 1.6,
      position: new Vector3(-4, spec.height / 2, spec.z),
      color: COURSE_COLORS.step,
    });
    builder.label(`STEP ${spec.height.toFixed(2)}m`, new Vector3(-4, spec.height + 0.9, spec.z));
  }
}

function buildCrouchTunnel(builder: CourseBuilder): void {
  // Tunnel interior: 1.6 wide, 1.3 high, 6 long — enterable only while
  // crouched (standing height 1.8), with standing room again at both ends.
  const x = 2;
  const zCenter = 9;
  const ceilingHeight = 1.3;
  builder.box('tunnel-wall-west', {
    width: 0.3,
    height: 2,
    depth: 6,
    position: new Vector3(x - 0.95, 1, zCenter),
    color: COURSE_COLORS.tunnel,
  });
  builder.box('tunnel-wall-east', {
    width: 0.3,
    height: 2,
    depth: 6,
    position: new Vector3(x + 0.95, 1, zCenter),
    color: COURSE_COLORS.tunnel,
  });
  builder.box('tunnel-ceiling', {
    width: 2.2,
    height: 0.3,
    depth: 6,
    position: new Vector3(x, ceilingHeight + 0.15, zCenter),
    color: COURSE_COLORS.tunnel,
  });
  builder.label('CROUCH TUNNEL', new Vector3(x, 2.2, zCenter - 4));
}

function buildJumpPlatformAndDeck(builder: CourseBuilder): void {
  // Jump platform: 0.9 m — beyond max step height (0.35) but within jump
  // reach (jump velocity 4.4 → apex ≈ 0.99 m).
  builder.box('jump-platform', {
    width: 3,
    height: 0.9,
    depth: 3,
    position: new Vector3(8, 0.45, 7),
    color: COURSE_COLORS.platform,
  });
  builder.label('JUMP 0.90m', new Vector3(8, 1.9, 5.2));

  // Elevated deck with an access ramp and a 2 m drop on the far side.
  builder.box('deck', {
    width: 6,
    height: 2,
    depth: 5,
    position: new Vector3(15, 1, 12),
    color: COURSE_COLORS.platform,
  });
  const angle = (18 * Math.PI) / 180;
  const rampLength = 2 / Math.sin(angle);
  builder.box('deck-ramp', {
    width: 3,
    height: 0.3,
    depth: rampLength,
    position: new Vector3(
      15,
      (rampLength / 2) * Math.sin(angle) - 0.1,
      9.5 - (rampLength / 2) * Math.cos(angle),
    ),
    rotationX: angle,
    color: COURSE_COLORS.rampWalkable,
  });
  builder.label('DECK + DROP', new Vector3(15, 3.0, 9));
}

function buildCorridorAndPillars(builder: CourseBuilder): void {
  // Narrow corridor: 1.0 m interior width (collider diameter 0.7).
  builder.box('corridor-wall-north', {
    width: 6,
    height: 2,
    depth: 0.3,
    position: new Vector3(8, 1, -6.35),
    color: COURSE_COLORS.wall,
  });
  builder.box('corridor-wall-south', {
    width: 6,
    height: 2,
    depth: 0.3,
    position: new Vector3(8, 1, -7.65),
    color: COURSE_COLORS.wall,
  });
  builder.label('NARROW CORRIDOR', new Vector3(8, 2.4, -7));

  // Collision pillars.
  builder.pillar('pillar-a', new Vector3(-8, 1.25, -8), 0.8, 2.5);
  builder.pillar('pillar-b', new Vector3(-10, 1.25, -10), 1.2, 2.5);
  builder.pillar('pillar-c', new Vector3(-6.5, 1.25, -11), 0.5, 2.5);
  builder.label('PILLARS', new Vector3(-8, 2.9, -9.5));
}
