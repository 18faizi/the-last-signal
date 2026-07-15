import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INSPECTION_VIEW_CONFIG as CONFIG,
  initialInspectionView,
  rotateInspectionView,
  zoomInspectionView,
} from '../../game/interaction/inspection/InspectionOrientation';

describe('inspection view math', () => {
  it('starts at the configured initial radius with zero rotation', () => {
    const view = initialInspectionView(CONFIG);
    expect(view.yaw).toBe(0);
    expect(view.pitch).toBe(0);
    expect(view.radius).toBe(CONFIG.initialRadius);
  });

  it('rotates with pointer deltas', () => {
    const view = rotateInspectionView(initialInspectionView(CONFIG), 100, 50, CONFIG);
    expect(view.yaw).toBeCloseTo(100 * CONFIG.rotateSensitivity);
    expect(view.pitch).toBeCloseTo(50 * CONFIG.rotateSensitivity);
  });

  it('clamps pitch at both limits', () => {
    const up = rotateInspectionView(initialInspectionView(CONFIG), 0, -100000, CONFIG);
    expect(up.pitch).toBe(CONFIG.minPitch);
    const down = rotateInspectionView(initialInspectionView(CONFIG), 0, 100000, CONFIG);
    expect(down.pitch).toBe(CONFIG.maxPitch);
  });

  it('clamps zoom at both limits', () => {
    const near = zoomInspectionView(initialInspectionView(CONFIG), -1e6, CONFIG);
    expect(near.radius).toBe(CONFIG.minRadius);
    const far = zoomInspectionView(initialInspectionView(CONFIG), 1e6, CONFIG);
    expect(far.radius).toBe(CONFIG.maxRadius);
  });

  it('reset returns to the initial view', () => {
    let view = rotateInspectionView(initialInspectionView(CONFIG), 300, 200, CONFIG);
    view = zoomInspectionView(view, 500, CONFIG);
    const reset = initialInspectionView(CONFIG);
    expect(reset.yaw).toBe(0);
    expect(reset.pitch).toBe(0);
    expect(reset.radius).toBe(CONFIG.initialRadius);
    expect(view.yaw).not.toBe(reset.yaw);
  });
});
