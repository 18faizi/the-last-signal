# Antenna Alignment

Once you've decoded `first_anomalous_transmission` at the control-room
receiver (see `signal-receiver.md`) and energized the rooftop/antenna
circuit at the distribution panel, the rooftop antenna deck's control
cabinet becomes operable: **[E] OPERATE ANTENNA CONTROLS**.

## Opening the panel

Interacting with the cabinet opens a full-screen accessible dialog (same
pattern as the receiver/distribution panels) showing:

- Array selection + azimuth/elevation/polarization control rows.
- Live alignment meters (per-axis quality + overall alignment).
- Waveguide route/continuity for the selected array's feed.
- A live bearing-estimate preview for the selected array.
- Source-analysis samples/state, and — once resolved — the reveal text.
- Receiver quality + analysis readiness (so you never need to run back to
  the control room to check whether your tuning has drifted — see
  `docs/architecture/bearing-analysis.md`'s "remote feedback" note).

## Controls (scoped to the panel — does not touch global bindings)

| Key               | Action                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `W` / `S`         | Select row (array / azimuth / elevation / polarization)                                              |
| `A` / `D`         | Adjust selected row (coarse step)                                                                    |
| `Shift` + `A`/`D` | Adjust (fine step)                                                                                   |
| `Enter`           | Collect a sample for the selected array, or — once all 3 required samples exist — run the comparison |
| `R`               | Park the selected array back to its default position                                                 |
| `Space`           | Emergency stop — halts motion in place                                                               |
| `Escape`          | Close the panel                                                                                      |

Mechanical movement is smooth and takes real time (a few seconds per
axis, depending on the array) — the dish visibly rotates/tilts on the
rooftop even while the panel is closed.

## What "Aligned" means

Each array has its own achievable quality ceiling — some arrays (the
easier North Dish) simply cannot reach as sharp a lock as others (the
narrow-tolerance East Relay Dish). "Aligned" means you've reached AS GOOD
as that specific array can get, not a single global bar. The alignment
meter shows your progress toward that array's own ceiling.

## Emergency stop and power loss

Space halts the selected array exactly where it is — no snapping back,
no overshoot. If the rooftop circuit loses power mid-motion, the dish
freezes in place (its exact position preserved) and does NOT resume
moving on its own once power returns — you'll need to re-issue the move
command.

See also: `microwave-array-selection.md`, `waveguide-routing.md`,
`source-bearing-analysis.md`.

## After the reveal (Milestone 0.9)

Resolving the source analysis — the confirmation that the transmission has
no valid external bearing — is no longer the end of the line: it arms the
facility's reactive threat sequence. Expect the rooftop warning light to
behave strangely on your way down. See `threat-presence.md` and
`first-threat-encounter.md`.
