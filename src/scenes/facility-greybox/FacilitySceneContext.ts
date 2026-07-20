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
import type { PowerNetwork } from '../../game/power/PowerNetwork';
import type { GeneratorController } from '../../game/generator/GeneratorController';
import type { DistributionPanelController } from '../../game/electrical/DistributionPanelController';
import type { EmergencyPowerController } from '../../game/electrical/EmergencyPowerController';
import type { PowerAccessQuery } from '../../game/access/PowerAccessQuery';
import type { ReceiverController } from '../../game/receiver/ReceiverController';
import type { ReceiverRuntimeState } from '../../game/receiver/ReceiverRuntimeState';
import type { AntennaController } from '../../game/antenna/AntennaController';
import type { AntennaRuntimeState } from '../../game/antenna/AntennaRuntimeState';
import type { WaveguideController } from '../../game/waveguide/WaveguideController';
import type { SourceAnalysisController } from '../../game/source-analysis/SourceAnalysisController';
import type { ThreatController } from '../../game/threat/ThreatController';
import type { ThreatRuntimeState } from '../../game/threat/ThreatRuntimeState';
import type { ManifestationController } from '../../game/threat/manifestation/ManifestationController';
import type { SoundStimulusRegistry } from '../../game/threat/perception/SoundStimulusRegistry';
import type { HidingController } from '../../game/threat/stealth/HidingController';
import type { HidingSpotRegistry } from '../../game/threat/stealth/HidingSpotRegistry';
import type { SafeZoneRegistry } from '../../game/threat/stealth/SafeZoneRegistry';
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

  // Power domain (Milestone 0.6)
  readonly powerNetwork: PowerNetwork;
  readonly generatorController: GeneratorController;
  readonly distributionPanel: DistributionPanelController;
  readonly emergencyPower: EmergencyPowerController;
  /** Power-aware access query fed to doors that combine item + power requirements. */
  readonly powerQuery: PowerAccessQuery;

  // Signal receiver domain (Milestone 0.7)
  readonly receiverController: ReceiverController;
  readonly receiverRuntimeState: ReceiverRuntimeState;

  // Antenna alignment / waveguide / source-analysis domain (Milestone 0.8)
  readonly antennaController: AntennaController;
  readonly waveguideController: WaveguideController;
  readonly sourceAnalysisController: SourceAnalysisController;
  readonly antennaRuntimeState: AntennaRuntimeState;

  // Threat / stealth / event-director domain (Milestone 0.9)
  readonly threatController: ThreatController;
  readonly threatRuntimeState: ThreatRuntimeState;
  readonly manifestationController: ManifestationController;
  readonly stimulusRegistry: SoundStimulusRegistry;
  readonly hidingController: HidingController;
  readonly hidingSpotRegistry: HidingSpotRegistry;
  readonly safeZoneRegistry: SafeZoneRegistry;

  // Shared resources
  readonly materials: FacilityMaterials;
  readonly geo: FacilityGeometryHelper;

  readonly devConfig: FacilityDevConfig;
}
