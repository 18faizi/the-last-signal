# Distribution Panel (dev notes)

`src/ui/power/DistributionPanelView.ts` + `src/game/interaction/power/PowerPanelSession.ts`

- `src/game/electrical/DistributionPanelController.ts` together implement the
  panel overlay, split across three layers for the same reason the M0.4
  inventory viewer and M0.3 document reader are split:

* **`DistributionPanelController`** (pure) — open/closed bookkeeping, circuit
  toggle requests routed through `BreakerController`, and `getPanelData()`
  for display.
* **`DistributionPanelView`** (DOM) — the actual dialog. Structurally follows
  `InventoryViewer.ts`: `role="dialog"`, `aria-modal`, focus moves to the
  close button on open, `Escape` closes. Its close-callback wiring instead
  follows `DocumentReaderView.ts`'s pattern (the view's own `close()` never
  invokes the stored callback — only the escape/click handlers do, and it's
  the _owning session_ that calls back into `view.close()`) to avoid
  re-entrant close calls.
* **`PowerPanelSession`** (Babylon+DOM glue, `game/interaction/power/`) —
  acquires the `'power-panel'` input-lock reason, suppresses the pointer-lock
  prompt, releases pointer lock (so the mouse is free to click toggle
  buttons), and implements `InteractionSystem`'s `PowerPanelControls`
  contract. Mirrors `DocumentController.ts` almost exactly.

## How it's wired into the interaction framework

`InteractionTarget` gained a `'panel'` kind (`isPanelTarget()` guard,
alongside the existing `'inspect'`/`'read'` guards) and `InteractionMode`
gained a `'power-panel'` mode, entered via the same `transitioning` gate as
`inspecting`/`reading`. The panel's world mesh (`buildDistributionPanel.ts`)
is a plain `'panel'`-kind target; `InteractionSystem.activate()` special-
cases it exactly like it already special-cases inspectable/readable targets,
calling `powerPanel.open(panelId, onClose)` instead of the target's own
`interact()`.

## Manual testing

1. Boot the dev server, walk to the control room (west wall).
2. `[E]` on the panel → dialog opens, gameplay input suspends (movement/look
   frozen, prompts hidden).
3. Toggle a circuit: capacity math updates live; an over-budget toggle shows
   an inline rejection banner without touching any other row.
4. `Escape` or the close button → dialog closes, gameplay resumes.

See `power-debugging.md` for how to inspect panel/network state without the
UI, and `manual-power-network-test-plan.md` for the full manual checklist.
