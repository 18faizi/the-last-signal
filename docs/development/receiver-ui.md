# Receiver UI

`src/ui/signal/` — DOM/canvas UI layer for the receiver panel. Follows
`src/ui/power/DistributionPanelView.ts`'s established pattern: role=dialog,
aria-modal, focus moves to the close button on open, Escape closes, focus
returns to the canvas on close via the owning session
(`ReceiverPanelSession`) — `ReceiverPanelView.close()` never invokes the
close callback itself, avoiding re-entrant close() calls.

## Composition

`ReceiverPanelView` owns:

- **`SpectrumView`** / **`WaveformView`** — canvas 2D visualizations.
- **`ReceiverControlView`** — the five tuning rows + SCAN/RESET buttons.
- **`DecodeProgressView`** — status message + lock/decode progress bars.
- **`TranscriptView`** — the decoded-transcript reader.

## One render loop, not several

`ReceiverPanelView` owns exactly **one** `requestAnimationFrame` loop,
started in `open()` and cancelled in `close()`/`dispose()`. Every frame it
reads `ReceiverController.getSnapshot()` once and passes the result to each
sub-view's `render()`/`draw()` method — the canvases never run their own
timers. This satisfies the milestone's constraint that canvas
visualizations "must only animate while the panel is open" and "must not
create a second Babylon render loop" (this is plain canvas 2D, not
Babylon, but the same one-loop discipline applies) — verified by the
repetition e2e tests checking `beforeRenderObserverCount` stays flat across
many open/close cycles.

## Canvas visualizations

Both `SpectrumView` and `WaveformView`:

- Use a **bounded sample count** (128 frequency bins / 192 waveform
  samples) regardless of canvas size.
- Cap `devicePixelRatio` at 2 before sizing the backing store, so a 3×/4×
  HiDPI display doesn't quadruple the pixel budget for no visible benefit.
- Compute all "noise" animation via a small deterministic pseudo-noise
  function (`sin(x·k + t·k2)` folded into `[0,1)`/`[-1,1)`) seeded by
  sample index and a caller-supplied elapsed-time value — **never**
  `Math.random()`, and the result is purely cosmetic: it's drawn, never
  read back into `SignalEvaluator` or the lock/decode controllers (see
  `docs/architecture/signal-domain.md`'s determinism section).
- Expose `resize()` (called every frame; cheap no-op when the backing
  store already matches) and `dispose()` (removes the canvas element).

`SpectrumView` renders a noise floor across the full 80–150 MHz axis, a
carrier peak only when the tuned channel matches the active signal's
channel (a Gaussian bump around the target frequency, scaled by the
current `overallQuality`), a tuning cursor, and the current channel number.

`WaveformView` renders a fixed-shape carrier sine (visual only — not the
literal RF waveform) blended with the same pseudo-noise term, with noise
amplitude shrinking as quality rises and reaching a perfectly clean line
once `mode === 'Decoded'`.

## Input handling

`ReceiverPanelView` attaches its own scoped `document.addEventListener('keydown', ...)`
and a `wheel` listener on the panel root while open, removed on close —
the same technique `DistributionPanelView`'s Escape handler and
`DocumentReaderView`'s Escape handler already use for full-screen modal
overlays in this codebase, extended here to cover row selection
(Up/Down/W/S), coarse/fine adjustment (Left/Right/A/D, Shift for fine),
scan/reset activation (Enter/Space, R), and Escape (closes the transcript
if open, otherwise the whole panel). This is intentionally **not** routed
through `InputAction`/`InputManager` — those already have `KeyR` bound to
the gameplay respawn action, and the receiver panel's own `R` (reset
controls) must not collide with it. Because `ReceiverPanelSession` holds a
`'receiver'` input lock for the panel's entire lifetime, gameplay input
(including the respawn binding) is already suspended — `InputManager` still
sees the same keydown and queues a `ResetPlayer` action, but
`FirstPersonController.update()` discards queued actions whenever gameplay
input is suspended, so the two can never fire together. See
`docs/architecture/input-suspension.md`.

Mouse wheel adjusts whichever row is currently selected (Shift for fine);
every row also has dedicated +/− buttons so nothing requires the keyboard.

## Transcript

`TranscriptView` reuses `DocumentReaderView`'s block-rendering function
(`renderDocumentBlock`, exported from `DocumentReaderView.ts` specifically
for this reuse) rather than duplicating a text renderer, but does **not**
reuse `DocumentController` — that class acquires its own input lock and
resumes gameplay on close, which is wrong here: the transcript lives
_inside_ the already-open receiver panel, and closing it must return to
the receiver panel, not to gameplay. `TranscriptView` is a plain
show/hide toggle within the panel's existing DOM tree and input lock.
