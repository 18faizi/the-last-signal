# Antenna Sample Sequence — Level Design

## Intended order

North Dish → East Relay Dish → Tower Diagnostic Loop, matching
`AntennaProgressionPhase`'s `FirstArraySampled → SecondArraySampled →
DiagnosticLoopSampled` naming and the milestone's documented full-progression
test. North Dish is the easiest to align (wide capture) and is not gated
behind the waveguide fix, making it a natural first sample. East Relay
requires both the routing fix and precise alignment, so it's a reasonable
second step. The Diagnostic Loop, having seemed irrelevant up to this
point, is saved for last so its revelatory role lands after the player
already has two "normal-looking" readings to compare it against.

## Not strictly enforced

The domain model does NOT require this exact order — samples are tracked
by count (1st/2nd/3rd), not by which specific array filled which slot (see
`docs/architecture/antenna-runtime-state.md`'s "ordinal sample-phase
naming" note). A player who samples the Diagnostic Loop first still
reaches the same final result; the phase names describe the intended
narrative beat, not a hard gate. This was a deliberate simplification to
avoid making the antenna panel context-sensitive to sampling order for no
gameplay benefit.

## Duplicate-sample guard as a pacing tool

Because a repeated sample for an already-sampled array is a no-op (not an
error, not a re-roll), the player is never punished for over-pressing
`Enter` — the panel's UI simply shows the array as already sampled and
moves on. This keeps the sampling step feel low-friction relative to the
higher-precision alignment step it follows.

## Analysis readiness as a soft difficulty signal

The analysis-readiness readout (receiver quality × antenna alignment ×
waveguide × power) gives the player continuous feedback on whether a
sample attempt is even worth making, without hard-blocking the `Enter`
key — an under-threshold attempt is simply rejected with a visible
"SampleRejected" outcome rather than silently no-op'ing, so the player
always understands why nothing happened.
