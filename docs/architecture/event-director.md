# Event Director

`src/game/event-director/` — a pure, typed, authored-event engine. **No
string scripting anywhere**: conditions and actions are discriminated-union
objects; adding a kind is a compile-time change in every executor.

## Definitions

`EventDefinition`: stable id, label, conditions (ALL must hold),
dependencies (event ids that must have fired; validated to exist and be
acyclic), oneShot flag, delaySeconds, ordered actions.

Conditions (`EventCondition.ts`): antenna-reveal-complete,
threat-phase-at-least, zone-discovered/zone-inside, circuit-energized,
signal-decoded, door-open, inventory-has, time-since-event, threat-state,
player-in-gameplay-mode, event-completed. They are evaluated against an
`EventConditionContext` of narrow query callbacks implemented by the scene
bindings — the director never imports PowerNetwork/ReceiverController/etc.

Actions (`EventAction.ts`): begin-manifestation, set-light
(on/off/blink/cut), operate-door, phone-indicator, begin-encounter,
enable-hiding-prompts, set-checkpoint, dev-message, threat-manifest /
resolve-manifestation / activate-unaware / route-to / investigate /
withdraw, complete-encounter, advance-threat-phase. Executed strictly in
authored order by an `EventActionExecutor` with per-action error isolation
(`EventSequence.runEventActions`).

## Evaluation model (no per-frame rescans)

Scene bindings subscribe to the relevant typed events (power, zone, door,
receiver, antenna runtime, threat, hiding, manifestation) and call
`director.evaluate()` on meaningful change. `update(dt)` — ticked from a
lightweight always-on observer — only advances the clock and pending
delays, re-checking `time-since-event` conditions at a 0.25 s cadence.

## Lifecycle

Idle → PendingDelay → Fired, plus Cancelled (terminal until reset).
One-shot events stay Fired forever. Repeatable events re-arm only after an
evaluation observes their conditions FALSE — they can never machine-gun
while conditions simply keep holding. `cancel()` works from Idle/Pending;
`reset()` (dev only) restores all events to Idle and zeroes the clock.

`EventValidation.ts` rejects duplicate ids, unknown/self/circular
dependencies, negative delays, empty action lists and conditions that
reference unknown events; the facility scene throws on problems in dev.
