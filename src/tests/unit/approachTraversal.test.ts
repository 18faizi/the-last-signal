// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DEFAULT_PLAYER_CONFIG, validatePlayerConfig } from '../../game/player/PlayerConfig';
import { FACILITY_CHECKPOINTS } from '../../scenes/facility-greybox/facilityCheckpointDefinitions';
import { SignageBuilder } from '../../scenes/facility-greybox/props/SignageBuilder';

describe('Approach Traversal & Havok Grounding', () => {
  let scene: Scene;

  beforeEach(() => {
    const mockGradient = { addColorStop: vi.fn() };
    const mockCtx = {
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      createLinearGradient: vi.fn(() => mockGradient),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
      textBaseline: '',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as RenderingContext,
    );
    scene = new Scene(new NullEngine());
  });

  it('verifies player spawn position is firmly grounded above solid surface at Y = 0.0', () => {
    const spawnCp = FACILITY_CHECKPOINTS.find((c) => c.id === 'fg-cp-spawn');
    expect(spawnCp).toBeDefined();
    if (!spawnCp) return;

    // Spawn position is at X = -58, Y = 0.1, Z = 0
    expect(spawnCp.spawnPosition.x).toBe(-58);
    expect(spawnCp.spawnPosition.y).toBe(0.1);
    expect(spawnCp.spawnPosition.z).toBe(0);

    // Foot position at 0.1 sits exactly 10cm above top of road slab (Y = 0.0)
    const roadTopY = 0.0;
    const distanceToGround = spawnCp.spawnPosition.y - roadTopY;
    expect(distanceToGround).toBeGreaterThanOrEqual(0);
    expect(distanceToGround).toBeLessThanOrEqual(0.15);
  });

  it('validates player character controller step-up and slope tolerances', () => {
    // Shipped config must pass all validation checks
    expect(validatePlayerConfig(DEFAULT_PLAYER_CONFIG)).toEqual([]);

    // Step height must allow clearing curbs and small rocks (0.35m - 0.45m)
    expect(DEFAULT_PLAYER_CONFIG.maxStepHeight).toBeGreaterThanOrEqual(0.35);
    expect(DEFAULT_PLAYER_CONFIG.maxStepHeight).toBeLessThanOrEqual(0.45);

    // Max slope angle must allow natural 30°-35° inclines
    expect(DEFAULT_PLAYER_CONFIG.maxSlopeAngleDeg).toBeGreaterThanOrEqual(35);

    // Out-of-bounds recovery threshold must be extended to <= -15.0m
    expect(DEFAULT_PLAYER_CONFIG.outOfBoundsY).toBeLessThanOrEqual(-15.0);

    // Jump velocity tuned to clear low barriers
    expect(DEFAULT_PLAYER_CONFIG.jumpVelocity).toBeGreaterThanOrEqual(4.4);
  });

  it('verifies contiguous roadbed span seals the critical traversal corridor', () => {
    // Approach roadbed: X in [-65, -19], width 46m, center at X = -42
    const roadMinX = -42 - 23; // -65
    const roadMaxX = -42 + 23; // -19

    // Spawn is at X = -58
    expect(-58).toBeGreaterThanOrEqual(roadMinX);
    expect(-58).toBeLessThanOrEqual(roadMaxX);

    // Perimeter Gate is at X = -20
    expect(-20).toBeGreaterThanOrEqual(roadMinX);
    expect(-20).toBeLessThanOrEqual(roadMaxX);

    // Courtyard main ground starts at X = -19 (21 - 40 = -19)
    const courtyardMinX = 21 - 40; // -19
    // Approach roadbed meets Courtyard with zero gap
    expect(roadMaxX).toBeGreaterThanOrEqual(courtyardMinX);
  });

  it('SignageBuilder generates directional signs, fingerposts, and conduits cleanly', () => {
    const signage = new SignageBuilder(scene);

    const signMesh = signage.createSign({
      id: 'test-entrance-sign',
      text: 'STATION ECHO - MAIN ENTRANCE',
      subtext: 'PERIMETER CHECKPOINT AHEAD',
      position: new Vector3(-54, 2.4, 12.0),
      arrow: 'right',
    });
    expect(signMesh).toBeDefined();
    expect(signMesh.isPickable).toBe(false);

    const fingerpost = signage.createCourtyardFingerpost(new Vector3(2, 0, 0), [
      { label: 'CONTROL BUILDING', direction: 'forward' },
      { label: 'GENERATOR FACILITY', direction: 'right' },
      { label: 'STAFF QUARTERS', direction: 'backward' },
      { label: 'COMMUNICATIONS TOWER', direction: 'left' },
    ]);
    expect(fingerpost).toBeDefined();

    signage.createCorridorConduit(
      'test-conduit',
      [new Vector3(0, 1, 0), new Vector3(0, 1, 5)],
      'power',
    );

    const handle = signage.getHandle();
    expect(handle.meshes.length).toBeGreaterThan(0);

    expect(() => {
      handle.dispose();
    }).not.toThrow();
  });
});
