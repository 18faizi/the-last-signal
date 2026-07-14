import type { RenderingBackend } from '../../state/applicationStore';

/**
 * Snapshot of what the created engine is actually running on. Populated by
 * EngineFactory at creation time; `physicsReady` is flipped by the physics
 * service once Havok initializes.
 */
export interface EngineCapabilities {
  backend: RenderingBackend;
  hardwareScalingLevel: number;
  devicePixelRatio: number;
  userAgent: string;
  renderWidth: number;
  renderHeight: number;
  physicsReady: boolean;
}
