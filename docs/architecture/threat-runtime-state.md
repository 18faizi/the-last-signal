# Threat Runtime State & Progression

## The fifth separate progression chain

`ThreatProgressionPhase.ts` mirrors the Signal/Antenna precedent exactly:
its own small, monotonic, strictly linear chain —

Inactive → AntennaAftermathPending → FirstManifestation →
DisturbanceSequence → InvestigationActive → StealthRequired →
PlayerDetected → PursuitActive → SafeZoneReached → EncounterResolved →
ThreatFoundationComplete

— tracked by `ThreatRuntimeState` as a FIFTH sibling next to the facility
`ProgressionPhase`, the power milestones embedded in it,
`SignalProgressionPhase` and `AntennaProgressionPhase`. The chains are never
merged; integration is via explicit prerequisite checks and typed event
subscriptions in `buildThreatEventBindings.ts`. Entry is gated on the M0.8
`AntennaRevealComplete` fact: the bindings advance
`AntennaAftermathPending` from the antenna runtime-state's typed completion
event (and reconcile once at bind time for checkpoint recovery).

Where a real event legitimately implies earlier milestones (e.g. a full
detection during a playthrough where the player never hid), handlers chain
through the intermediate phases with `tryAdvancePhase` — the same
chain-through pattern `facilityAntennaBindings.ts` established.

## ThreatRuntimeState scope

Exactly like ReceiverRuntimeState/AntennaRuntimeState: it records only the
coarse, EVENT-DRIVEN milestones — phase advances, completed director event
ids, encounter start/one-shot completion, manifestations seen, hiding spots
discovered, safe-zone arrival, withdraw count, encounter reset count. The
high-frequency fields (position, suspicion, detection, route node) are
exposed live by `ThreatController.getSnapshot()` (a plain getter, never a
per-frame write) and are deliberately NOT mirrored here.
