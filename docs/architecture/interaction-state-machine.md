# Interaction-mode state machine

`src/game/interaction/InteractionMode.ts` defines one central transition
table (mirroring the application lifecycle machine) instead of scattered
booleans:

```
gameplay      → holding | transitioning | inventory
holding       → gameplay
transitioning → inspecting | reading | power-panel | receiver | antenna-panel | gameplay
inspecting    → gameplay
reading       → gameplay
inventory     → gameplay
power-panel   → gameplay
receiver      → gameplay
antenna-panel → gameplay
```

- **gameplay** — focus raycasting, prompts, press/hold input live here.
- **holding** — an eligible hold is in progress; cancellation (key release,
  focus loss, range loss, pointer-lock loss, window blur) or completion
  returns to gameplay.
- **transitioning** — an overlay (inspection/document/power-panel) is being
  set up; inputs are ignored, duplicate activations impossible. On setup
  failure it falls back to gameplay (with a recoverable error report and the
  input lock released).
- **inspecting / reading** — overlay owns the screen; the only exit is
  gameplay.
- **inventory** (M0.4) — entered directly from `gameplay` (global `Tab`
  toggle, not a world-object interaction), not through `transitioning`.
- **power-panel** (M0.6) — entered through `transitioning`, exactly like
  `inspecting`/`reading`, because it's triggered by interacting with a
  world object (the distribution panel mesh) rather than a global hotkey.
  `InteractionTarget` gained a `'panel'` kind (`isPanelTarget()`, alongside
  the existing `isInspectableTarget()`/`isReadableTarget()` guards);
  `InteractionSystem.activate()` special-cases it identically to
  inspect/read, calling `powerPanel.open(panelId, onClose)` instead of the
  target's own `interact()`. Per-frame, `update()`'s `power-panel` branch
  mirrors the `reading` branch: it checks `powerPanel.isOpen` and
  transitions back to `gameplay` once the dialog closes.
- **receiver** (M0.7) — the signal receiver's full-screen tuning panel.
  Added as a direct sibling of `power-panel`: same `transitioning` entry
  path (world-object interaction, not a hotkey), same `InteractionTarget`
  pattern (`'receiver'` kind, `isReceiverTarget()` guard,
  `InteractionSystem.activate()` calling `receiverPanel.open(onClose)`
  instead of `interact()`), same per-frame `update()` branch shape
  (`receiverPanel.isOpen` check, fall back to `gameplay` once closed). The
  table's structural symmetry with `power-panel` is what makes "prevent
  receiver from opening during inventory/reading/inspecting/power-panel,
  and prevent those from opening during receiver" fall out for free: every
  one of those modes' only listed successor is `gameplay`, so none of them
  can reach `receiver` (or each other) directly — see
  `interactionModeReceiver.test.ts`.

- **antenna-panel** (M0.8) — the rooftop antenna control cabinet's
  full-screen panel. A direct sibling of `power-panel`/`receiver`: same
  `transitioning` entry path, same pattern (`'antenna'` kind,
  `isAntennaTarget()` guard, `InteractionSystem.activate()` calling
  `antennaPanel.open(onClose)`), same per-frame `update()` branch shape.
  The waveguide junction box near the antenna deck deliberately does
  **not** get its own mode — it stays an `'immediate'`-kind target (the
  same kind as the fuel valve/breaker/selector), cycling its route on
  each `[E]` press without ever entering an overlay mode. See
  `docs/architecture/waveguide-domain.md`'s "design choice" note for why.

Consequences enforced by the table (unit-tested in
`interactionMode.test.ts`, `interactionModeInventory.test.ts`,
`interactionModeReceiver.test.ts`): reading cannot begin while inspecting
(and vice versa); no overlay can begin during an active hold; a cancelled
hold and a closed overlay always return to gameplay; `assertModeTransition`
throws on anything else, so an illegal jump is a bug surfaced immediately
rather than silent state corruption. Scene disposal is mode-independent:
every subsystem (`InteractionSystem`, `InspectionController`,
`DocumentController`, `PowerPanelSession`, `ReceiverPanelSession`,
`AntennaPanelSession`) disposes its own resources regardless of the
current mode.

Focus is modeled separately (`FocusStability.ts`) — it is a property of
gameplay/holding, not a machine state.
