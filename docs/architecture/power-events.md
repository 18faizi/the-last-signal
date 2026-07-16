# Power Events

Two independent typed event streams, both following the existing
`InventoryEvent`/`DoorEvent` pattern: a discriminated union on `kind`,
delivered through a `subscribe(listener): () => void` API with swallowed
listener errors (a broken UI callback must never corrupt domain state).

## PowerEvent (`src/game/power/PowerEvent.ts`)

| Kind                              | Fired when                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `source-state-changed`            | `PowerNetwork.setSourceAvailability` changes a source's availability.                             |
| `circuit-requested`               | Every `requestCircuit` call, before validation — observability for "the player tried this".       |
| `circuit-energized`               | A circuit's effective state becomes `energized`.                                                  |
| `circuit-de-energized`            | A circuit's effective state becomes `de-energized` (manual off, cascade, or `deEnergizeCircuit`). |
| `allocation-rejected`             | A `requestCircuit('on')` fails validation; `reason` is the user-facing string.                    |
| `capacity-changed`                | A source's `allocatedCapacity` changes.                                                           |
| `load-powered` / `load-unpowered` | A load's `powered` flag flips, following its circuit.                                             |
| `emergency-transfer`              | `transferCircuits` successfully re-homes a circuit.                                               |

## GeneratorEvent (`src/game/generator/GeneratorEvent.ts`)

Named events for every state-machine transition
(`GeneratorReady`, `GeneratorCranking`, `GeneratorStarted`, `GeneratorStable`,
`GeneratorStopped`, `GeneratorFaulted`, `MainBreakerOpened`,
`MainBreakerClosed`) plus a catch-all `ControlChanged` (with a `control`
discriminator: `fuelValve` | `starterBattery` | `emergencyStop` | `selector`
| `mainBreaker`) for the ancillary controls, so debug views and
`FacilityRuntimeState`'s mirror can react to any single field without one
named event per control.

## Who listens

- `FacilityGreyboxScene.ts` subscribes to both streams once, at scene setup,
  mirroring the relevant fields into `FacilityRuntimeState` (see
  `power-runtime-state.md`) and driving progression-phase advancement
  (`GeneratorStarted`, `MainBreakerClosed` → `MainPowerAvailable`) and the
  emergency-power handoff (`MainBreakerClosed` → `EmergencyPowerController
.onGeneratorMainBreakerClosed()`).
- `PoweredStateBinding` (`powered-load-bindings.md`) subscribes per
  circuit/load for world representation.
- `PowerDebugOverlay` (F10) and the compact status widgets
  (`PowerStatusView`, `GeneratorStatusView`) subscribe for their own
  refresh-on-change rendering — never per-frame polling of the whole
  network.
