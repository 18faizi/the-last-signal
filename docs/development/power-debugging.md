# Power Debugging

## F10 — power network debug overlay

Development-only, mirrors the F9 `FacilityDebugOverlay` pattern exactly
(`src/scenes/facility-greybox/overlay/PowerDebugOverlay.ts`):

- A DOM text panel (top-right) listing generator control state, every
  source's availability/capacity, every circuit's requested/effective
  state/cost/source, and every load's powered flag — refreshed at a reduced
  rate (every 30 frames while visible), never per-frame.
- A small set of non-pickable, non-colliding marker spheres at each power
  indicator's world position (reusing `buildPoweredIndicators.ts`'s
  `INDICATORS` list), colour-coded green/red for powered/unpowered,
  `setEnabled(false)` while the overlay is hidden so they cost nothing when
  not in use.

Toggle with `F10`. Entirely absent in production builds — like every other
dev overlay, it's only constructed when `context.environment.isDevelopment`.

## F3 — extended debug overlay

The general debug overlay (`Backquote`/`F3`) gained compact generator/power
rows in `FacilityGreyboxScene.ts`'s `getDebugFields()`: generator state,
fuel valve/battery/e-stop in one line, selector/breaker in one line,
generator and battery capacity (`allocated/max (availability)`), a circuit
summary (`N energized / M requested / T total`), panel open/closed, receiver
activated, and the power milestone flag. No nested dumps — every power-
domain field is one flat row.

## Dev bridge (`window.__TLS_TEST__`, development only)

Beyond the existing M0.3–0.5 surface, the facility scene adds:

- `getPowerSnapshot()` — full `PowerNetwork.getSnapshot()`.
- `getGeneratorSnapshot()` / `getGeneratorReadiness()`.
- `generatorAction(name)` — one of `openFuelValve`, `closeFuelValve`,
  `connectBattery`, `disconnectBattery`, `releaseEmergencyStop`,
  `engageEmergencyStop`, `setSelectorManual`, `inspect`, `closeMainBreaker`,
  `stop`. Returns `false` for an unknown action.
- `requestCircuit(circuitId, sourceId, 'on' | 'off')` — direct
  `PowerNetwork.requestCircuit` passthrough.
- `toggleCircuit(circuitId)` — routes through the same breaker the panel UI
  uses.
- `openDistributionPanel()` / `closeDistributionPanel()` / `isDistributionPanelOpen()`.
- `activateReceiver()`.
- `resetFacility()` — the dev full-reset action (see `power-runtime-state.md`).

`getFacilityState()` (existing) now also returns a `power` field — see
`architecture/power-runtime-state.md`.

**None of these bridge functions set generator/circuit/milestone state
directly on behalf of the _starter_ control** — `generatorAction` has no
"complete the crank" action; the only way to actually start the generator,
in tests or in the browser, is the real 2-second hold on the starter mesh.
This is deliberate: it's what lets `tests/e2e/power.spec.ts`'s full-
progression test claim it exercises the real interaction framework.
