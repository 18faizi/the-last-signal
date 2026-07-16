/**
 * Pure readiness evaluation: given the generator's current control state,
 * produce the ordered list of startup steps (met/unmet) and a single
 * blocking reason string suitable for an interaction prompt.
 */
import type { FuelValveState } from './GeneratorController';
import type { StarterBatteryState } from './GeneratorController';
import type { EmergencyStopState } from './GeneratorController';
import type { ControlSelectorState } from './GeneratorController';
import type { GeneratorStartupStep } from './GeneratorStartupStep';

export interface GeneratorControlSnapshot {
  readonly fuelValve: FuelValveState;
  readonly starterBattery: StarterBatteryState;
  readonly emergencyStop: EmergencyStopState;
  readonly selector: ControlSelectorState;
}

export interface StartupReadiness {
  readonly ready: boolean;
  readonly steps: readonly GeneratorStartupStep[];
  /** First unmet step's label, formatted for a prompt; null when ready. */
  readonly blockingReason: string | null;
}

export function evaluateStartupReadiness(snapshot: GeneratorControlSnapshot): StartupReadiness {
  const steps: GeneratorStartupStep[] = [
    { id: 'fuel-valve', label: 'FUEL VALVE OPEN', met: snapshot.fuelValve === 'Open' },
    {
      id: 'starter-battery',
      label: 'STARTER BATTERY CONNECTED',
      met: snapshot.starterBattery === 'Connected',
    },
    {
      id: 'emergency-stop',
      label: 'EMERGENCY STOP RELEASED',
      met: snapshot.emergencyStop === 'Released',
    },
    { id: 'selector', label: 'SELECTOR SET TO MANUAL', met: snapshot.selector === 'Manual' },
  ];
  const firstUnmet = steps.find((s) => !s.met);
  return {
    ready: firstUnmet === undefined,
    steps,
    blockingReason: firstUnmet !== null && firstUnmet !== undefined ? firstUnmet.label : null,
  };
}
