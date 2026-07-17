# Antenna Panel (UI)

`src/ui/antenna/AntennaPanelView.ts` follows `ReceiverPanelView.ts`'s
accessible-dialog pattern exactly: `role=dialog`, `aria-modal`, focus
moves to the close button on open, Escape closes, a `document`-level
keydown listener scoped to `open()`/`close()` (never the global
`InputAction` system, so it can never collide with R-respawn or other
bindings while open).

## Composition

- **`AntennaControlView.ts`** — array selection row + azimuth/elevation/
  polarization rows, mirrors `ReceiverControlView.ts`'s row-based
  construction and `render(snapshot, selectedRow)` contract.
- **`AlignmentMeterView.ts`** — azimuth/elevation/polarization/overall
  quality bars, mirrors `DecodeProgressView.ts`'s bar-plus-label pattern.
- **`WaveguideStatusView.ts`** — read-only route/port/continuity display
  for the selected array's feed (the fix itself happens at the physical
  junction box, not in this panel — see `waveguide-domain.md`).
- **`BearingDisplayView.ts`** — a LIVE bearing-estimate preview computed
  from the same pure `evaluateBearing()` used for recorded samples, but
  itself never a recorded sample.
- **`SourceAnalysisView.ts`** — samples list, comparison state, and the
  reveal text once resolved.

## Animation-frame loop discipline

ONE `requestAnimationFrame` loop, started in `open()`, cancelled in
`close()`/`dispose()` — this NEVER touches or duplicates
`ReceiverPanelView`'s own loop. It exists specifically for the
continuously-varying alignment meters and live bearing preview; discrete
state changes (waveguide route corrections, sample collection) are cheap
enough to recompute alongside the same frame rather than justifying a
second observer.

## Remote rooftop feedback (spec §27)

Rather than building a separate remote-telemetry system, the panel simply
always shows receiver quality / analysis readiness as part of its own
live readout — the player operates the antenna cabinet ON the rooftop
already, so "don't make the player walk back to the control room to check
receiver quality" is satisfied by the panel itself, not a new subsystem.

## Keyboard contract

See `docs/gameplay/antenna-alignment.md`'s control table. `Enter` is
CONTEXTUAL by design (the milestone's fixed minimal key set has no
separate "compare" key): it collects a sample first, then — once all
required samples exist — the same key runs the comparison.

## Constructor dependencies

`AntennaPanelView` holds `AntennaController`/`WaveguideController`/
`SourceAnalysisController` directly for reads (mirrors
`ReceiverPanelView` holding `ReceiverController` directly) and calls their
WRITE methods directly from its own private handlers — it does NOT touch
`AntennaRuntimeState` or fire progression events; that wiring lives
exclusively in `facilityAntennaBindings.ts`, subscribed to the same
controllers' typed events.
