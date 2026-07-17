# Antenna Runtime State

## `AntennaProgressionPhase.ts`

A dedicated, strictly linear progression chain — the THIRD progression
enum in the codebase, alongside the facility `ProgressionPhase` (M0.5/
M0.6) and `SignalProgressionPhase` (M0.7). Mirrors
`SignalProgressionPhase.ts`'s architecture-decision precedent exactly:
rather than extending either existing enum, the antenna/waveguide/bearing
puzzle gets its own chain, tracked by `AntennaRuntimeState` as a sibling.

```
Unavailable → DecodedSignalRequired → RooftopPowerRequired
  → AntennaPanelOnline → WaveguideCorrectionRequired → ReadyForSamples
  → FirstArraySampled → SecondArraySampled → DiagnosticLoopSampled
  → BearingContradictionDetected → LocalLoopCandidate
  → AntennaRevealComplete
```

Integration with the other two enums is via explicit prerequisite checks
and typed event subscriptions in `facilityAntennaBindings.ts` — never a
merged enum. Prerequisites for even ENTERING this chain:
`first_anomalous_transmission` already decoded (M0.7's
`ReceiverRuntimeState`) AND the rooftop/antenna circuit energized —
reaching the rooftop alone does not advance it.

### Architecture decision: ordinal sample-phase naming

`FirstArraySampled`/`SecondArraySampled`/`DiagnosticLoopSampled` advance
strictly by HOW MANY samples have been collected so far (1st/2nd/3rd), not
by checking WHICH specific array was sampled at each position. The
milestone's documented test sequence samples the diagnostic loop last, but
nothing in the domain model requires that order — the phase names describe
the typical intended play order, not a per-array assertion. See
`facilityAntennaBindings.ts`'s doc comment.

### "Requirement announcement" phases auto-chain

`AntennaPanelOnline` and `WaveguideCorrectionRequired` are entered
automatically, back-to-back, the instant `RooftopPowerRequired` is reached
(i.e. the moment the cabinet is powered) — they describe SYSTEM
availability, not a distinct player action. The REAL player actions
(waveguide correction, alignment, sampling, comparison) each gate their
OWN phase via a real domain event, never an auto-chain.

## `AntennaRuntimeState.ts`

Mirrors `ReceiverRuntimeState.ts`'s architecture-decision comment exactly:
this class does NOT re-mirror `AntennaController`'s continuously-changing
fields (selected array, mechanical positions, parked flags, per-array
quality) or `WaveguideController`'s route state — those are already
exposed live via each controller's own `getSnapshot()` (a plain getter,
not a per-frame write), and neither controller is ever recreated across
checkpoints/respawn, so that state persists "for free". This class only
records the coarse, EVENT-DRIVEN milestones: phase advances, and which
arrays have been sampled (`recordSampleCollected`, idempotent per array —
prevents duplicate `sample-collected` events, verified explicitly).

## Checkpoint / OOB recovery

Since `AntennaController`/`WaveguideController`/`SourceAnalysisController`
are constructed once at scene creation and never recreated by the
checkpoint/OOB-recovery path (only the player's position teleports), their
live state — mechanical positions, waveguide routes, collected samples —
survives automatically. `AntennaRuntimeState`'s phase/sample bookkeeping
survives the same way. Verified end-to-end by
`tests/e2e/antenna.spec.ts`'s power-cycle and respawn tests.

## Dev full reset

The facility dev-reset action (`resetFacility` on the test bridge) resets,
in order: `antennaController.reset()` (parks every array, clears
selection, `Offline`), `waveguideController.reset()` (every path back to
its default port/state), `sourceAnalysisController.reset()` (clears
samples, `Unavailable`), `antennaRuntimeState.reset()` (phase back to
`Unavailable`, samples/reveal cleared), then re-pushes each array's
waveguide continuity from the now-reset `WaveguideController`. The
`maybeUnlockSampling()` guard in `facilityAntennaBindings.ts` checks
`sourceAnalysisController.analysisState !== 'Unavailable'` (the
CONTROLLER'S own state) rather than a local closure flag, specifically so
repeated resets don't leave stale "already activated" bookkeeping behind.
