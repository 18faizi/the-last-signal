# Manual Antenna Alignment Test Plan

Companion to `docs/development/manual-signal-receiver-test-plan.md`,
scoped to Milestone 0.8. Run through this in a real browser after any
change touching `src/game/antenna/`, `src/game/waveguide/`,
`src/game/source-analysis/`, `src/ui/antenna/`, or the
`src/scenes/facility-greybox/antenna/` builders.

## Prerequisites gating

1. Reach the rooftop deck before decoding the transmission or powering
   the rooftop circuit → the antenna cabinet prompt reads `NO POWER`,
   `[E]` does nothing.
2. Decode `first_anomalous_transmission` at the control-room receiver
   (see the signal-receiver test plan) WITHOUT touching the rooftop
   circuit yet → confirm via F2 overlay that `Antenna phase` is still
   `Unavailable`/`DecodedSignalRequired`, not further along.
3. Energize the rooftop circuit from the distribution panel → the
   cabinet visibly changes color (dark → green tint), prompt becomes
   `[E] OPERATE ANTENNA CONTROLS`, and F2 shows `RooftopPowerRequired`
   then immediately `WaveguideCorrectionRequired`.

## Waveguide junction

1. Walk to the junction box (separate from the cabinet) → prompt reads
   `[E] CYCLE ROUTE (TEST PORT (INACTIVE))`.
2. Press `[E]` repeatedly → the label cycles through every candidate port;
   confirm it wraps back to the start after the last one.
3. Stop on the correct receiver-input port → F2 overlay confirms
   `wg-waveguide-east-relay: Connected`, and the antenna panel's waveguide
   status row for East Relay Dish shows `CONTINUITY: 100%`.

## Antenna panel controls

1. `[E]` the cabinet → full-screen dialog opens, gameplay input suspends,
   focus lands on the close button.
2. `W`/`S` cycles the row highlight through Array/Azimuth/Elevation/
   Polarization.
3. On the Array row, `A`/`D` cycles the selected array; confirm the dish
   ACTUALLY VISIBLE on the rooftop (through a window, or by closing the
   panel and looking) rotates to match once a target is commanded.
4. On an axis row, `A`/`D` adjusts by the coarse step; `Shift`+`A`/`D`
   by the fine step. Confirm the alignment meter updates live.
5. Command a large azimuth move, then immediately close the panel
   (`Escape`) and watch the physical dish on the rooftop — it should keep
   rotating smoothly toward the target even with the panel closed.
6. `Space` mid-motion → the dish visibly stops in place, no snapping.
7. `R` → the selected array parks back to its default position.

## Alignment + sampling

1. Align each array to its target (East Relay Dish: azimuth 42°,
   elevation 18°, polarization -35°) → the alignment meter's overall bar
   should settle near that array's own ceiling (North Dish tops out
   around 60%, not 100% — this is correct, not a bug).
2. `Enter` on an aligned array → a sample appears in the source-analysis
   list; pressing `Enter` again on the same array does NOT add a second
   entry.
3. Attempt `Enter` on a poorly-aligned array → no sample is recorded
   (confirm via F2 overlay's sample count staying the same).

## Reveal

1. Once all 3 arrays are sampled, `Enter` again → runs the comparison;
   the source-analysis panel shows each sample's category/confidence,
   then the final reveal text.
2. Confirm the reveal text is hedged ("PRELIMINARY", "NOT CONCLUSIVE")
   and does not confirm a supernatural cause.
3. Close and reopen the panel → the reveal text is still there, no
   re-comparison happens (confirm no flicker/reset).
4. Cycle the rooftop circuit off then back on from the distribution
   panel → dish positions, samples, and the reveal all survive; confirm
   via F2 overlay that `Antenna phase` is still `AntennaRevealComplete`.

## Dev tools

1. `F2` toggles the antenna debug overlay; confirm it's absent by
   default and shows live az/el/pol + quality + sample data once open.
2. `F3` overlay shows the compact antenna summary alongside the existing
   power/signal fields.
3. Trigger a full dev reset (test bridge `resetFacility()` or the
   equivalent dev menu action) → antenna arrays park, waveguide reverts
   to Misrouted, samples clear, reveal resets, panel closes, no stale
   input lock (confirm WASD/mouse-look work immediately after).
