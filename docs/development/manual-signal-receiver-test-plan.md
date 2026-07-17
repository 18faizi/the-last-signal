# Manual Signal Receiver Test Plan

Companion to `docs/development/manual-power-network-test-plan.md`, scoped
to Milestone 0.7. Run through this in a real browser after any change
touching `src/game/signal/`, `src/game/receiver/`, `src/ui/signal/`, or the
`src/scenes/facility-greybox/signal/` builders.

## Power gating

1. Approach the receiver console (control room, next to the distribution
   panel) with the control-room circuit unpowered → prompt reads
   `NO POWER`, `[E]` does nothing.
2. Bring the generator up and energize the control room circuit from the
   distribution panel → the console visibly changes color (dark → green
   tint) within ~1.5 seconds (boot), then the prompt becomes
   `[E] OPERATE SIGNAL RECEIVER`.
3. Turn the control-room circuit back off mid-boot (toggle it the instant
   you see it energize) → the console reverts to unpowered; F11 overlay
   (see below) confirms `Mode: Offline`.

## Opening the panel

1. `[E]` the console → full-screen dialog opens, gameplay input suspends
   (mouse look/WASD do nothing while it's open), focus lands on the close
   button.
2. Confirm the spectrum (top) and waveform (below it) canvases are
   animating — noisy waveform, flat-ish spectrum with no visible peak
   while untuned.
3. `Escape` → dialog closes, gameplay resumes immediately, prompt
   reappears.

## Tuning

1. Reopen the panel. Use Up/Down (or W/S) to move the row selection
   highlight through all five rows (Channel, Frequency, Gain, Filter,
   Phase).
2. Use Left/Right (or A/D) on Channel until it reads `3`.
3. Use Left/Right on Frequency, watching the spectrum's tuning cursor
   move; a small bump should appear on the spectrum once frequency is
   roughly close, growing taller as you approach the target.
4. Hold Shift while pressing Left/Right → the step size visibly shrinks
   (fine adjustment) — useful for the last bit of precision.
5. Use the mouse wheel over the panel → adjusts whichever row is
   currently selected; Shift+wheel is fine adjustment.
6. Click a row's `+`/`−` buttons directly → same effect as the keyboard,
   confirming the controls are fully mouse-operable.
7. Watch the limiting-factor banner below the controls — it should name
   exactly one issue at a time (e.g. "ADJUST GAIN") and disappear once
   everything's close enough.

## Scan

1. Click SCAN (or press Enter/Space while not yet decoded) → channel and
   frequency begin sweeping automatically; gain/filter/phase stay put.
2. Watch it pause briefly on channel 3 — a `ChannelActivityDetected`
   moment (visible via the F11 overlay's signal phase, or just watching
   the sweep visibly pause there).
3. Manually adjust any control (e.g. nudge gain) → the sweep stops
   immediately, control returns to you.
4. Click SCAN again, then STOP SCAN (same button, relabeled) → sweep
   cancels cleanly, no leftover partial state.

## Lock and decode

1. Tune all five controls close to their targets (channel 3, ~117.4 MHz,
   ~60% gain, ~65% filter, ~−18° phase — see
   `docs/level-design/tuning-difficulty-balance.md` for the full
   tolerances). Status line should progress NO SIGNAL → CARRIER DETECTED
   → ACQUIRING LOCK.
2. Hold steady for ~2 seconds → status becomes LOCKED, the waveform
   settles into a clean, stable shape.
3. Keep holding → status becomes DECODING, the decode bar fills over
   ~5 seconds.
4. Nudge a control moderately off-target mid-decode (not drastically) →
   status becomes SIGNAL UNSTABLE, decode bar **freezes** (doesn't reset).
   Re-tune back → decoding resumes from where it paused.
5. Detune drastically (e.g. gain to 0) while decoding → lock breaks
   entirely, status becomes SIGNAL LOST, decode progress resets to 0. You
   have to re-acquire lock from scratch.
6. Repeat tuning to completion → status becomes TRANSMISSION DECODED, a
   VIEW TRANSCRIPT button appears in the header.

## Transcript

1. Click VIEW TRANSCRIPT → the decoded document appears, styled like the
   existing document reader.
2. `Escape` → closes just the transcript, back to the receiver panel
   (not out to gameplay — confirm the panel is still visible underneath).
3. `Escape` again → closes the whole panel, back to gameplay.

## Persistence

1. Reopen the receiver (already decoded) → jumps straight to
   TRANSMISSION DECODED without needing to re-tune.
2. Cut control-room power, then re-energize it → receiver reboots, and
   reopening still jumps straight to TRANSMISSION DECODED (the decoded
   state survives a power cycle; only the _live_ tuning/lock session
   resets).
3. Fall off a ledge (or dev respawn) mid-tuning → confirm tuning
   controls and lock/decode progress are unchanged after respawn (F11
   overlay).

## Dev tools

1. `F11` → signal debug overlay appears (bottom-right), shows target
   values alongside current values and every per-control quality number.
2. Confirm F11 is inert (no visual/behavioral effect) while the receiver
   panel is closed, beyond toggling its own DOM panel.
3. Dev full reset (existing reset action) → receiver returns to
   `Offline`, controls reset to defaults, decoded signals cleared; F3/F11
   confirm.
