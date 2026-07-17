# Rooftop Antenna Puzzle — Level Design

## Intent

M0.7 established that a real transmission exists and can be decoded. M0.8
asks a follow-up question the player should already be forming: WHERE did
it come from? The rooftop antenna deck (M0.5 greybox, now with real
mechanical controls) is where that question gets a deterministic — and
unsettling — answer.

## Structure

1. **Gate**: reach the rooftop, decode the transmission, power the
   rooftop circuit. None of these alone is sufficient; all three gate
   entry into the antenna progression chain (`AntennaProgressionPhase`).
2. **Mechanical puzzle**: operate the antenna cabinet, align three
   distinct arrays with distinct difficulty profiles (see
   `antenna-difficulty-balance.md`).
3. **Routing puzzle**: discover and correct the East Relay Dish's
   misrouted waveguide feed — a separate, physically distinct interaction
   from the main cabinet, forcing the player to actually walk the space.
4. **Analytical puzzle**: sample all three arrays, run the comparison,
   read the reveal.

## Why three arrays, not one

A single "align the dish" puzzle would answer nothing narratively — of
course a transmission has SOME bearing if you only ever measure it once.
Three independently-tuned arrays with deliberately different
characteristics (see `microwave-array-selection.md`) let the comparison
itself carry the reveal: the contradiction across all three readings is
the evidence, not a scripted cutscene.

## Pacing

The waveguide fix is placed BEFORE meaningful sampling is possible
(`ReadyForSamples` requires it) so the player doesn't spend real effort
perfecting East Relay's alignment only to discover its feed was dead the
whole time — the routing puzzle is cheap (a handful of `[E]` presses) and
deliberately front-loaded.

## World placement

Antenna cabinet and the three dish assemblies occupy the existing M0.5
rooftop deck footprint (`buildRooftopAntennaDeck.ts`) — North Dish and
East Relay Dish reuse the two existing dish-mount positions
(`fac-dish-mount-1`/`fac-dish-mount-2`), and the Tower Diagnostic Loop
sits near the existing lattice tower base geometry, giving it a plausible
in-world reason to have been overlooked until now.
