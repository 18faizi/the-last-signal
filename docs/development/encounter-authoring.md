# Encounter Authoring Guide

How to author new reactive events/encounters (M0.9 architecture).

## 1. Author data, not code

- Nav nodes / hiding spots / safe zones / manifestations / fixtures:
  `src/scenes/facility-greybox/threat/facilityThreatDefinitions.ts`.
- Events + reset plan:
  `src/scenes/facility-greybox/threat/facilityEncounterDefinitions.ts`.

Every id is a stable string constant. Positions are world coordinates
grounded in the greybox builders.

## 2. Events

An `EventDefinition` needs: stable id, typed conditions (ALL must hold),
dependencies (previously-fired events), oneShot or repeatable, an optional
delay, and ordered typed actions. Never add string scripting — extend the
`EventAction`/`EventCondition` unions and the executor/context instead
(compile-time exhaustive).

Rules of thumb:

- Gate the first event of a chain on the progression fact that makes it
  meaningful (`antenna-reveal-complete`, `threat-phase-at-least`, ...).
- Use `player-in-gameplay-mode` on anything the player must witness.
- Use `time-since-event` for pacing instead of timers in code.
- Repeatable events re-arm only after their conditions go false — design
  conditions so that holds (see the reactivation keeper).

## 3. Threat behavior

Activate the actor with `threat-activate-unaware` (patrol) or
`threat-manifest` + `threat-resolve-manifestation` (staged). Give it a
route with `threat-route-to`. Everything else — investigation, search,
pursuit, withdrawal — is systemic and driven by real player stimuli.

## 4. Failure plan

Author an `EncounterResetPlan`: checkpoint, threat reset node, the explicit
list of doors to restore, dev message. The reset executor touches ONLY what
the plan lists — that is the structural "preserves all progression"
guarantee. Wire captures to it via the `PlayerCaptured` event.

## 5. Validate + test

Dev builds throw on invalid data at scene creation. Add the new ids to the
validation context, extend `threat.spec.ts` following its bridge
discipline, and keep every timing authored (no `Math.random`).
