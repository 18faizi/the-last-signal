# Antenna Debugging

## F2 — antenna/bearing debug overlay

Dev-only, hidden by default, toggled via `InputAction.ToggleAntennaDebug`
(bound to `F2`). F2 was chosen specifically because **F12 conflicts with
browser devtools** — see `src/core/input/InputAction.ts`'s doc comment.

`src/scenes/facility-greybox/overlay/AntennaDebugOverlay.ts` mirrors
`SignalDebugOverlay.ts`'s (F11) pattern exactly: a DOM text panel
refreshed at a reduced rate (`tick()` called from the same zone-polling
`onBeforeRenderObservable` hook as every other dev overlay), never
constructed in production.

Shows, per array: control state, current/target az-el-pol, target values

- tolerances, waveguide state/port, per-axis + alignment/overall quality,
  limiting factor — plus source-analysis state, samples (category,
  confidence, stability, external-source-valid), and the final result's
  explanation tags once resolved. Formatters live in
  `src/game/antenna/AntennaDebugView.ts` (`formatAntennaDebugFields`) — pure
  string functions, no Babylon/DOM, shared with the F3 compact summary
  (`formatAntennaCompactFields`).

## F3 — compact overlay extension

`FacilityGreyboxScene.ts`'s `getDebugFields()` appends: antenna
powered/selected-array/state/alignment-quality, sample count, source-
analysis state/classification, antenna progression phase, reveal
completion.

## F9/F10/F11 — unaffected

The facility, power, and signal debug overlays are untouched by this
milestone; F2 is a wholly new key, and every existing F-key binding keeps
its exact prior behavior.

## Dev bridge (`window.__TLS_TEST__`)

New surface (dev builds only, `undefined` in production — verified by the
production smoke check): `getAntennaSnapshot`, `getAntennaRuntimeSnapshot`,
`getWaveguideSnapshot(pathId)`, `getSourceAnalysisSnapshot`,
`openAntennaPanel`/`closeAntennaPanel`/`isAntennaPanelOpen`,
`antennaAction(action, value)` (`selectArray`/`setAzimuth`/`setElevation`/
`setPolarization`/`park`/`emergencyStop`), `selectAntennaArray(arrayId)`,
`cycleWaveguidePort(pathId)`, `collectSourceSample`,
`runSourceAnalysisComparison`. Every setter goes through the REAL domain
controller method — the bridge never sets quality/samples/bearing
results/classification directly (see `tests/e2e/antenna.spec.ts`'s own
doc comment for the exact discipline).

## Reproducing the two bugs this milestone's debugging caught

Both are now regression-tested (see `manual-antenna-alignment-test-plan.md`
and `antennaController.test.ts`):

1. A fixed-absolute `Aligned` quality threshold made a low-`maxQuality`
   array (North Dish) structurally unable to ever align — fixed by making
   the threshold a RATIO of the array's own ceiling.
2. `recomputeMetrics()`'s state-reconciliation guard skipped itself
   whenever the CURRENT label was already `'Moving'`, so nothing ever
   moved a settled array OUT of `'Moving'` after arrival — fixed by
   deriving the guard from whether motion is actually mid-transit right
   now, not from the stale label.
