/**
 * Pure inspection view math: model yaw/pitch and camera zoom radius with
 * clamping — unit-tested without Babylon.
 */
export interface InspectionViewState {
  readonly yaw: number;
  readonly pitch: number;
  readonly radius: number;
}

export interface InspectionViewConfig {
  readonly rotateSensitivity: number;
  readonly minPitch: number;
  readonly maxPitch: number;
  readonly minRadius: number;
  readonly maxRadius: number;
  readonly initialRadius: number;
  /** Radius change per wheel-delta unit (browser wheel deltas ≈ ±100/notch). */
  readonly zoomPerWheelUnit: number;
}

export const DEFAULT_INSPECTION_VIEW_CONFIG: InspectionViewConfig = {
  rotateSensitivity: 0.006,
  minPitch: (-80 * Math.PI) / 180,
  maxPitch: (80 * Math.PI) / 180,
  minRadius: 0.7,
  maxRadius: 2.4,
  initialRadius: 1.3,
  zoomPerWheelUnit: 0.0022,
};

export function initialInspectionView(config: InspectionViewConfig): InspectionViewState {
  return { yaw: 0, pitch: 0, radius: config.initialRadius };
}

export function rotateInspectionView(
  state: InspectionViewState,
  deltaX: number,
  deltaY: number,
  config: InspectionViewConfig,
): InspectionViewState {
  const yaw = state.yaw + deltaX * config.rotateSensitivity;
  const pitch = clamp(
    state.pitch + deltaY * config.rotateSensitivity,
    config.minPitch,
    config.maxPitch,
  );
  return { yaw, pitch, radius: state.radius };
}

export function zoomInspectionView(
  state: InspectionViewState,
  wheelDelta: number,
  config: InspectionViewConfig,
): InspectionViewState {
  const radius = clamp(
    state.radius + wheelDelta * config.zoomPerWheelUnit,
    config.minRadius,
    config.maxRadius,
  );
  return { yaw: state.yaw, pitch: state.pitch, radius };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
