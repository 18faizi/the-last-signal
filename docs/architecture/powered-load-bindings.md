# Powered Load Bindings

`PoweredStateBinding` (`src/game/electrical/PoweredStateBinding.ts`) is the
reusable glue room builders use instead of hand-rolling
`powerNetwork.isCircuitEnergized(...)` checks scattered through geometry
code.

## The binding itself is Babylon-free

```ts
PoweredStateBinding.forCircuit(network, circuitId, (powered: boolean) => { ... });
PoweredStateBinding.forLoad(network, loadId, (powered: boolean) => { ... });
```

Both fire the callback immediately with the current value, then again on
every relevant `circuit-energized`/`circuit-de-energized` (or
`load-powered`/`load-unpowered`) event. `.dispose()` unsubscribes. Nothing
here imports `@babylonjs/*` — the callback signature is a plain boolean, so
the binding satisfies the "no Babylon/DOM in `src/game/electrical/`"
constraint even though it exists specifically to drive Babylon mutations.

## The Babylon-facing half lives in the scene layer

`src/scenes/facility-greybox/power/facilityPowerBindings.ts` provides two
thin helpers built on top of the binding:

- `bindEmissiveToCircuit(network, circuitId, material, poweredColor, unpoweredColor?)`
  — swaps a `StandardMaterial`'s `emissiveColor`.
- `bindLightToCircuit(network, circuitId, light, poweredIntensity, unpoweredIntensity?)`
  — toggles a `Light`'s `intensity`.

`buildPoweredIndicators.ts` uses both to wire six indicator lamps (one per
circuit with a natural real-world location: security, generator hall,
tunnel, staff quarters, rooftop, archive) — each a small emissive sphere
plus a real `PointLight`, dark until its circuit energizes. It returns the
created bindings so `FacilityGreyboxScene.ts` can dispose them on scene
teardown (they're plain `PowerNetwork` subscriptions, not owned by any
`InteractionTarget`, so nothing else disposes them automatically).

`buildDistributionPanel.ts`'s receiver target uses the same binding
directly: its `PoweredStateBinding.forCircuit(controlRoomCircuit, ...)`
callback swaps the receiver's material and updates its own
`getAvailability()` closure state (`NO POWER` ↔ available) — disposed via
the receiver `InteractionTarget`'s own `dispose()`, since that binding _is_
scoped to that one target's lifetime.

## Pattern for future powered props

1. Register the load/circuit with `PowerNetwork` (`facilityPowerDefinitions.ts`).
2. Call `PoweredStateBinding.forCircuit`/`forLoad` (directly, or through the
   `facilityPowerBindings.ts` helpers) with a callback that mutates the
   prop's Babylon-side representation.
3. Dispose the binding wherever the owning target/builder already disposes
   its other resources.
