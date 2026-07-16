# Interaction framework

## Overview

```
InteractionSystem                 one scene observer; orchestrates everything
  ├─ InteractionRaycaster         one center-camera pick per frame
  ├─ FocusStability (pure)        grace-period focus retention + events
  ├─ HoldInteraction (pure)       hold progress/cancel/complete-once
  ├─ InteractionRegistry          mesh → target resolution (typed, id-only metadata)
  ├─ InteractionHighlight         per-mesh renderOverlay tint (non-destructive)
  ├─ InteractionPromptFormat (pure) + InteractionPromptView (DOM)
  ├─ InspectionController         isolated-model inspection mode
  ├─ DocumentController           document reading mode
  └─ InteractionDebugView         dev-only F6 ray visualization
```

## Registering a target

Implement `InteractionTarget` (`src/game/interaction/InteractionTarget.ts`)
and register it:

```ts
registry.register({
  id: 'generator-breaker-2',
  kind: 'hold',
  meshes: [breakerRootMesh],       // children resolve automatically
  holdDurationSeconds: 1.5,
  getPrompt: () => ({ verb: 'RESET', label: 'BREAKER 2' }),
  getAvailability: () => (powered ? AVAILABLE : { status: 'disabled', reason: 'REQUIRES POWER' }),
  interact: () => { …; return { status: 'completed' }; },
});
```

Kinds: `immediate`, `hold`, `inspect` (adds `buildInspectionModel` +
`inspectionTitle`), `read` (adds `documentId`), `disabled`. There is no
switch on mesh names anywhere — behavior comes entirely from the contract.

## Child-mesh resolution

`registry.register` stamps each target mesh **and its mesh descendants**
with the target id in `mesh.metadata` (an identifier only — systems live in
the registry's typed map). `resolveFromMesh` walks a picked mesh's parent
chain until it finds a stamped node, so a decorative knob can never steal
focus from the radio that owns it.

## Focus detection

One `scene.pickWithRay` per frame from the camera center (reused Ray, no
per-frame allocation; the result object is reused too). Predicate: pickable

- enabled + visible — debug meshes and dev labels are `isPickable = false`
  by construction, so they are skipped without name checks. Because plain
  world geometry is pickable, **line of sight falls out of nearest-hit
  semantics**: a wall (or glass pane) in front of a target produces a
  non-target hit and the target cannot be focused. Transparent materials do
  not imply raycast transparency.

Classification: nothing / world hit (blocked) / target in range / target
out of range. Range = min(`interactionDistance` 2.6 m, target
`maxDistance`); the probe itself is 8 m so out-of-range targets are still
classified for debug display. **Out-of-range behavior (documented choice):
the prompt is hidden entirely** — no `[E]` is ever shown for a press that
cannot succeed.

## Focus stability

Strategy: **loss grace period** (150 ms). A momentary raycast miss (mesh
edge, micro head movement) keeps the current focus; a genuinely different
valid target replaces focus immediately; looking away clears focus after
the grace expires. Enter/exit callbacks fire exactly once per transition.
`selectPreferredTarget` breaks near-equal-distance ties (±5 cm) by explicit
target priority, then by distance.

## Availability and prompts

`getAvailability()` returns `available`, `disabled` (+ reason) or `busy`.
`formatPrompt` (pure, unit-tested) produces the display model:
`[E] USE SWITCH`, `[HOLD E] RESET BREAKER`, or the bare reason
(`REQUIRES POWER`) for disabled targets — never a key hint that cannot
succeed. The DOM prompt view mutates text only when values change.

## Hold behavior

Configured per target (`holdDurationSeconds`, `repeatable`). Progress
accrues only while: interact key held + target focused + in range +
available. Any condition loss cancels (release, look away, walk away,
pointer-lock loss — which is also how Escape cancels — and window blur).
Completion fires the target's `interact()` exactly once and latches until
the key is released; the test breaker then reports `disabled`
(`BREAKER READY`) so it cannot re-complete.

## Async readiness

`interact()` may return a Promise. While pending the target is **busy**:
prompts show a waiting state, duplicate activations are blocked, rejection
reports a recoverable error and clears the busy state. The dev async
terminal target demonstrates this with an artificial 600 ms delay
(development-only; the framework itself adds no delays).

## Error handling

Focus callbacks, availability queries and interactions are wrapped: a
throwing target produces a recoverable `GameError` report (never the fatal
screen), focus/prompt state is cleared or degraded (`UNAVAILABLE`), and
gameplay input is restored. A target unregistered while focused is dropped
by a per-frame registry check. Inspection setup failure tears down the
half-built session (releasing the input lock) before reporting.

## Doors, switches, and panels (built in M0.4/M0.6)

A door is an `immediate` (or `hold`) target whose `interact()` drives the
door subsystem (`DoorController`/`DoorInteractionTarget`, M0.4); a locked
door reports `{ status: 'disabled', reason: 'LOCKED' }` (or the lock's
specific reason, e.g. `'TUNNEL CIRCUIT NOT ENERGIZED'`) until the
`AccessEvaluator` says otherwise — see `powered-access.md` for how a lock's
`AccessRequirement` tree can now combine item and power conditions. The
generator's control panel (M0.6) is seven `immediate`/`hold` targets built by
`GeneratorInteractionTargets.ts` — no framework changes needed, exactly as
predicted.

A full-screen panel (the distribution panel) needed one small framework
addition: a `'panel'` `TargetInteractionKind` (`isPanelTarget()` guard,
alongside `isInspectableTarget()`/`isReadableTarget()`), handled in
`InteractionSystem.activate()` and a new `'power-panel'` `InteractionMode` —
otherwise built the same way inspection/reading were: acquire an input
lock, own the screen, release on close. See
`../architecture/interaction-state-machine.md` and
`../development/distribution-panel.md`.

## Current limitations

- Availability is re-queried per frame for the focused target only; a
  target wanting global availability broadcasting would need its own event.
- The raycaster returns the single nearest hit; overlapping same-depth
  targets rely on `selectPreferredTarget`, which is exercised in unit tests
  but rarely hit in practice.
- Highlight uses `renderOverlay`, which tints whole meshes (no outline).
