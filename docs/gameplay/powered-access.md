# Powered Access

`AccessRequirement` gained a `power` kind in Milestone 0.6: a lock or door
can now require a circuit to be energized, combined with item requirements
through the same `AnyOf`/`AllOf` composability that has always driven the
facility's locks. Nothing about `DoorController` changed to support this —
it still just evaluates whatever `AccessRequirement` tree it's given.

## The tunnel maintenance door

`fg-door-tunnel-maintenance`'s lock now reads:

```ts
allOf(
  requireItem('fg-maintenance-card'),
  requirePower(CIRCUIT_TUNNEL_ID, { poweredReason: 'TUNNEL CIRCUIT NOT ENERGIZED' }),
);
```

The maintenance card alone is no longer sufficient — the tunnel circuit
(cost 3) must also be energized from the distribution panel. This is the
demonstration case for combined inventory+power access.

## Fail-safe semantics

- **No power query configured** (a scene with no `PowerNetwork`, or a lock
  evaluated before wiring) → a `power` requirement always **denies**. Power
  gating fails closed, never open.
- **Power lost after a powered door has already unlocked** → the door's
  lock state, like every item lock, transitions to `unlocked` permanently
  once the access check passes. Losing power afterwards does **not** relock
  it, and does not force it closed if it happens to be open mid-swing —
  `DoorController`'s physical open/close state machine is entirely
  independent of the lock check, which only runs once, at the moment of
  interaction. This is a deliberate design decision: a door slamming shut
  because a generator died would be a "trap the player" failure mode the
  milestone spec explicitly calls out to avoid. See
  `docs/architecture/door-state-model.md` for the underlying state machine.

## Extending this pattern

Any future powered prop follows the same recipe: register a `PowerCircuitId`
with `PowerNetwork`, add `requirePower(circuitId)` to the relevant
`AccessRequirement` tree (bare, or combined via `allOf`/`anyOf`), and pass a
`PowerAccessQuery` (`{ isCircuitEnergized }`, trivially implemented by
`PowerNetwork` itself) into whatever `AccessEvaluator` instance guards it.
