# Interaction-mode state machine

`src/game/interaction/InteractionMode.ts` defines one central transition
table (mirroring the application lifecycle machine) instead of scattered
booleans:

```
gameplay      → holding | transitioning
holding       → gameplay
transitioning → inspecting | reading | gameplay
inspecting    → gameplay
reading       → gameplay
```

- **gameplay** — focus raycasting, prompts, press/hold input live here.
- **holding** — an eligible hold is in progress; cancellation (key release,
  focus loss, range loss, pointer-lock loss, window blur) or completion
  returns to gameplay.
- **transitioning** — an overlay (inspection/document) is being set up;
  inputs are ignored, duplicate activations impossible. On setup failure it
  falls back to gameplay (with a recoverable error report and the input
  lock released).
- **inspecting / reading** — overlay owns the screen; the only exit is
  gameplay.

Consequences enforced by the table (unit-tested in
`interactionMode.test.ts`): reading cannot begin while inspecting (and vice
versa); no overlay can begin during an active hold; a cancelled hold and a
closed overlay always return to gameplay; `assertModeTransition` throws on
anything else, so an illegal jump is a bug surfaced immediately rather than
silent state corruption. Scene disposal is mode-independent: every
subsystem (`InteractionSystem`, `InspectionController`,
`DocumentController`) disposes its own resources regardless of the current
mode.

Focus is modeled separately (`FocusStability.ts`) — it is a property of
gameplay/holding, not a machine state.
