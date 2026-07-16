/**
 * Typed context object passed to all facility scene builders.
 *
 * This is the single injection point: each builder receives the context and
 * pulls only the services it needs.  No globals, no module-level singletons.
 */
import type { Scene } from '@babylonjs/core/scene';
import type { EnvironmentInfo } from '../../config/environment';
import type { InteractionRegistry } from '../../game/interaction/InteractionRegistry';
import type { DocumentRegistry } from '../../game/interaction/documents/DocumentRegistry';
import type { InventoryService } from '../../game/inventory/InventoryService';
import type { InventoryRegistry } from '../../game/inventory/InventoryRegistry';
import type { DoorRegistry } from '../../game/doors/DoorRegistry';
import type { PickupRegistry } from '../../game/pickups/PickupRegistry';
import type { ZoneRegistry } from '../../game/facility/ZoneRegistry';
import type { TriggerVolumeSet } from '../../game/facility/TriggerVolume';
import type { CheckpointRegistry } from '../../game/facility/Checkpoint';
import type { TeleportRegistry } from '../../game/facility/TeleportRegistry';
import type { FacilityRuntimeState } from '../../game/facility/FacilityRuntimeState';
import type { FacilityMaterials } from './FacilityMaterials';
import type { FacilityGeometryHelper } from './FacilityGeometryHelper';

/** Whether the scene is running in development mode (enables debug tools). */
export interface FacilityDevConfig {
  readonly isDevelopment: boolean;
}

/**
 * Full context passed to every builder.  Contains scene, registries, services
 * and the shared geometry/material helpers.
 */
export interface FacilitySceneContext {
  // Babylon scene
  readonly scene: Scene;
  readonly environment: EnvironmentInfo;

  // Registries
  readonly interactionRegistry: InteractionRegistry;
  readonly documentRegistry: DocumentRegistry;
  readonly itemRegistry: InventoryRegistry;
  readonly doorRegistry: DoorRegistry;
  readonly pickupRegistry: PickupRegistry;
  readonly zoneRegistry: ZoneRegistry;
  readonly triggerVolumes: TriggerVolumeSet;
  readonly checkpointRegistry: CheckpointRegistry;
  readonly teleportRegistry: TeleportRegistry;

  // Services
  readonly inventory: InventoryService;
  readonly facilityState: FacilityRuntimeState;

  // Shared resources
  readonly materials: FacilityMaterials;
  readonly geo: FacilityGeometryHelper;

  readonly devConfig: FacilityDevConfig;
}
