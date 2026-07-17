# Antenna Events

Three typed event unions, one per domain, each with a minimal pub/sub bus
mirroring `SignalEvent.ts`'s "fields optional per-kind, narrow on kind"
pattern — never a bespoke type per emitter.

## `AntennaEvent.ts`

```
ArraySelected | MovementStarted | MovementCompleted | MovementStopped
| Aligned | AlignmentLost | PowerLost | PowerRestored | Parked
| EmergencyStopped
```

- `MovementStarted` fires ONCE per motion session — commanding all three
  axes (azimuth/elevation/polarization) in the same tick fires it once,
  not three times (tracked via a `wasMidTransit` check before the command
  is applied).
- `MovementCompleted` fires ONCE when all three axes have settled
  (`targetXDeg === null` for all three), not once per axis.
- `Aligned`/`AlignmentLost` fire only on an actual DERIVED control-state
  transition — repeatedly holding `Aligned` across many ticks never
  re-fires `Aligned`.
- `EmergencyStopped` and `MovementStopped` both fire together on
  `emergencyStop()` — the former is the discrete action, the latter is the
  motion-lifecycle signal (useful for UI/audio hooks that only care "did
  motion stop", regardless of why).

## `WaveguideEvent.ts`

```
RouteChanged | RouteCorrected | RouteBroken
```

`RouteChanged` fires on every port change. `RouteCorrected` fires exactly
once when a route transitions INTO `Connected` from a non-`Connected`
state. `RouteBroken` fires exactly once when a route LEAVES `Connected`
for a wrong port. State is derived deterministically from "does the
current port match the correct port" — there is no separate transition
table to keep in sync.

## `SourceAnalysisEvent.ts`

```
SampleCollected | SampleRejected | ComparisonStarted
| ContradictionDetected | LocalLoopCandidateDetected | AnalysisResolved
```

`SampleCollected` fires once per array per analysis cycle — a duplicate
`collectSample()` call for an already-sampled array returns the EXISTING
sample without re-firing. `AnalysisResolved` fires exactly once; calling
`runComparison()` again after resolution is a guarded no-op (checked at
the top of the method, before any state mutation) that returns the cached
result without re-emitting anything — see
`sourceAnalysisController.test.ts`'s "resolves exactly once" tests.

## Facility-level wiring

`facilityAntennaBindings.ts` subscribes to all three buses and is the
ONLY place that translates domain events into `AntennaRuntimeState` phase
advances (`AntennaProgressionPhase`) — the domain controllers themselves
never know about progression. See `antenna-runtime-state.md`.
