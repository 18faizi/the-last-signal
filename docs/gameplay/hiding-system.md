# Hiding System

## Spots

Four authored hiding spots exist in the control building
(`facilityThreatDefinitions.ts`):

| id                         | kind              | zone            | concealment | fully hiding |
| -------------------------- | ----------------- | --------------- | ----------- | ------------ |
| `fg-hide-cabinet-relay`    | equipment cabinet | relay room (F1) | 1.0         | yes          |
| `fg-hide-locker-stairwell` | locker            | control room    | 1.0         | yes          |
| `fg-hide-under-desk`       | under-desk        | control room    | 0.85        | no           |
| `fg-hide-alcove-relay`     | dark alcove       | relay room (F1) | 0.9         | no           |

Concealment is **explicit authored data** consumed by the perception model —
never inferred from mesh opacity or render state.

## Interaction flow

Hiding uses the standard interaction architecture end to end:

1. Each spot registers a `HidingSpotTarget` (kind `'hiding'`) showing
   `[E] HIDE <NAME>`. Prompts are director-gated: before the encounter's
   `enable-hiding-prompts` action fires they read `NOTHING TO HIDE FROM`.
2. Pressing E routes through the central `InteractionMode` table:
   `gameplay → transitioning → hiding`. While in `hiding` mode, inventory,
   receiver, power panel, antenna panel, reading, inspection and doors are
   unreachable **by construction** (none is a legal successor state).
3. `HidingSession` acquires a token-based input lock (`'hiding'`), saves the
   exact player transform (position, yaw, pitch), parks the collider at the
   spot's authored safe interior point and glides the camera smoothly
   (0.35 s smoothstep) to the authored camera position. No clipping is
   possible because both points are authored and validated.
4. `[E] LEAVE HIDING PLACE` exits: the saved transform is restored exactly
   (including pitch) and the input-lock release clears stale pressed keys
   and buffered jumps.

## Rules

- Fully-hiding spots make visual detection impossible (hard zero).
- Entering a spot while observed does **not** erase accumulated suspicion.
- Loud stimuli emitted while hiding still raise suspicion.
- One spot can be occupied at a time (registry-enforced).
- A capture can never occur while fully hidden or inside a safe zone.
