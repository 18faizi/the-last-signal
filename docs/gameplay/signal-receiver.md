# Signal Receiver

Milestone 0.7 replaces M0.6's provisional "[E] ACTIVATE RECEIVER" one-shot
with a real console: a frequency-tuning puzzle that surfaces the facility's
first anomalous transmission.

## Reaching the receiver

The receiver console sits in the control room, next to the distribution
panel, at the same world position M0.6's placeholder occupied. It requires:

1. The generator `Running` with its main breaker closed.
2. The **Control Room** circuit energized from the distribution panel.

Until both hold, the console shows `NO POWER` and cannot be opened. Once the
control-room circuit energizes, the receiver **boots** (about 1.5 seconds —
see `docs/architecture/receiver-state-model.md`) and then shows
`[E] OPERATE SIGNAL RECEIVER`.

## Opening the panel

Pressing `[E]` opens a full-screen dialog (`ReceiverPanelView`) — gameplay
input suspends exactly like the distribution panel and inventory overlays.
The panel shows:

- A **spectrum** display (frequency axis, noise floor, and — once tuned to
  the right channel — a carrier peak) and a **waveform** display (noisy
  until tuned, clean once locked/decoded).
- Five tuning **controls**: channel, frequency, gain, filter, phase.
- A **lock/decode status** readout with two progress bars.
- **SCAN** and **RESET** buttons.

See `docs/gameplay/frequency-tuning.md` for how to operate the controls and
`docs/gameplay/signal-lock-and-decode.md` for what happens once you're
tuned in.

## Scanning

Pressing SCAN sweeps the channel and frequency through a fixed, repeating
pattern, pausing briefly on channel 3 to flag "carrier detected" — a hint,
not a solution: gain, filter and phase are untouched by the sweep, so
scanning alone never locks the signal. Adjusting any control by hand
cancels the scan immediately.

## Closing and reopening

Escape or the close button returns to gameplay. The receiver keeps
whatever progress it had — tuning values, lock state, decode progress, or a
completed decode — so closing to explore and coming back later picks up
exactly where you left off. Losing control-room power (breaker trips,
circuit switched off) resets the live tuning session, but a transmission
you already fully decoded stays remembered for the rest of the session —
reopening on that channel jumps straight back to the decoded transcript.
