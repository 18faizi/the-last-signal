# Receiver Puzzle Flow

## Prerequisites

The receiver puzzle sits at the end of the M0.6 power-setup chain: the
generator must be running with its main breaker closed, and the control
room circuit energized from the distribution panel. See
`docs/level-design/power-progression.md` and `docs/level-design/facility-power-plan.md`.

## Discovery

The console is visible (unpowered, dark) as soon as the player reaches the
control room — no separate discovery gate. Approaching it without power
shows `NO POWER`, which itself communicates "come back once the facility is
powered" without needing a document to explain it.

## The puzzle itself

1. **Power on** — the console boots automatically (~1.5s) once the
   control-room circuit energizes.
2. **Find the channel** — six channels, one carries a signal (channel 3).
   Scanning surfaces this without requiring the player to brute-force all
   six by hand, but scanning alone never solves the rest.
3. **Tune** — frequency, gain, filter and phase all need to land near
   their (unlabeled, discoverable-by-feel) targets. The limiting-factor
   banner keeps this a guided process rather than blind trial and error —
   see `docs/level-design/tuning-difficulty-balance.md` for why the
   tolerances are set where they are.
4. **Hold the lock** — a couple of seconds of sustained good tuning.
5. **Let it decode** — about five seconds of sustained lock.
6. **Read the transcript** — the payoff: a short, unsettling, explicitly
   provisional piece of narrative (see `first-transmission-design.md`).

## What this unlocks

Decoding the required transmission completes the milestone's dedicated
signal-progression chain (`SignalPuzzleComplete` — see
`docs/architecture/signal-runtime-state.md`). Nothing else in the world
reacts to it yet — no new areas open, no new documents appear — that's
explicitly out of scope for this milestone (no antenna alignment, no
additional transmissions; see the milestone's non-negotiable constraints).
