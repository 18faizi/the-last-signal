# Waveguide Domain

`src/game/waveguide/` is the pure-TypeScript layer for the antenna feed
routing puzzle. No Babylon/DOM — the junction-box mesh/interaction target
lives in `src/game/antenna/AntennaJunctionTarget.ts` and
`src/scenes/facility-greybox/antenna/buildWaveguideNetwork.ts`.

## Files

- **`WaveguideState.ts`** — `Connected | Disconnected | Misrouted |
Damaged | Bypassed`, plus `continuityForWaveguideState()` mapping each
  state to a graded 0-1 continuity contribution (`Connected`→1,
  `Bypassed`→0.5, everything else→0). No transition table is needed —
  state is derived purely from "does the current port match the correct
  port" (see `WaveguideController.applyPort()`).
- **`WaveguideDefinition.ts`** — static per-path data: descriptive
  segment labels (feed → rooftop run → feedthrough → receiver input),
  every candidate port, the correct port id, and the DEFAULT port/state
  the path starts at.
- **`WaveguideController.ts`** — owns route/port selection + derived
  continuity for every registered path; `cyclePort()` (the junction box's
  single-press interaction) advances to the next candidate port,
  wrapping around; `setPort()` is the explicit form. Emits `RouteChanged`/
  `RouteCorrected`/`RouteBroken` (see `antenna-events.md`).
- **`WaveguideEvent.ts`** — typed event union + bus.
- **`WaveguideValidation.ts`** — duplicate ids, minimum 2 ports,
  `correctPortId`/`defaultPortId` must exist among the path's own ports,
  at least one segment label.

## The East Relay puzzle (spec §23)

`facilityAntennaDefinitions.ts` registers three waveguide paths:

- **North Dish** and **Tower Diagnostic Loop** start already `Connected`
  — no puzzle there, matching spec §10's characterization of those two
  arrays as comparatively straightforward.
- **East Relay Dish** starts `Misrouted`, routed to an inactive
  `test-port` — the ONE waveguide puzzle this milestone introduces. The
  player corrects it at the physical junction box near the antenna deck
  by cycling through candidate ports with repeated `[E]` presses until
  the prompt label shows the correct route and the state flips to
  `Connected`.

## Continuity feeds AntennaController, never the reverse

`facilityAntennaBindings.ts` pushes each path's `continuity` value into
`AntennaController.setWaveguideQuality(arrayId, quality)` whenever a
`WaveguideController` event fires — event-driven, never per-frame (see
`AntennaController.ts`'s doc comment on `setWaveguideQuality()`).
`WaveguideController` itself never imports or references
`AntennaController` — the two domains are sibling-decoupled, composed only
by the scene-wiring layer.

## Design choice: 'immediate'-kind interaction, not a panel

`AntennaJunctionTarget.ts` models the junction box as a single
`immediate`-kind `InteractionTarget` (mirrors
`GeneratorInteractionTargets.ts`'s fuel-valve/breaker/selector precedent)
rather than a dedicated small modal or the full antenna panel mode. Each
`[E]` press cycles the route and the prompt label always shows the
CURRENT route, so "inspect junction, see current route, select correct
path, confirm" all happen through the same immediate-interaction
affordance already used throughout the facility — no new
InteractionMode/InputLock entry needed for what is fundamentally a
single-axis, single-step routing puzzle.
