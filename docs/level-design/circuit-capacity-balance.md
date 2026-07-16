# Circuit Capacity Balance

The generator supplies 10 capacity units. The seven circuits' costs sum to
17 (1 + 4 + 1 + 3 + 2 + 4 + 2) — **not everything can be on at once.** This
is intentional: the milestone's non-negotiable constraint #9 requires the
costs to force a real trade-off, and 17 > 10 guarantees that with margin (a
naive "turn everything on" playthrough fails at the fifth or sixth circuit,
not the last one).

## Worked scenario

After the main breaker closes, the emergency circuit (1 unit) has already
been transferred onto the generator, leaving **9 free units**. Reasonable
combinations the player might reach for:

- Control Room (4) + Cable Tunnel (3) + Staff Quarters (2) = 9 — exactly
  fits, uses every remaining unit. Rooftop/Antenna and Archive stay dark.
- Control Room (4) + Rooftop/Antenna (4) = 8, one unit spare — not enough
  left for anything else.
- Cable Tunnel (3) + Staff Quarters (2) + Archive (2) + 2 spare — leaves
  room to reconsider, but the Control Room (and its receiver) stays dark.

Since the **Control Room circuit gates the milestone's completion trigger**
(the field receiver), a player who spends all 9 units elsewhere has to
notice and re-balance — the panel shows requested vs. effective state and a
rejection reason on overflow, so this is discoverable rather than opaque.

## Why these specific costs

- **Emergency & Security (1)**: cheap enough that the 2-unit battery can
  carry it alone before the generator ever starts — that's the entire point
  of having an emergency circuit.
- **Generator Auxiliary (1)**: the room housing the generator itself should
  be trivially affordable to light.
- **Control Room (4)** and **Rooftop/Antenna (4)**: the two "big" circuits,
  deliberately priced so no combination of two 4-cost circuits plus the
  transferred emergency circuit fits in 10 (4+4+1=9, technically fits
  exactly — see below) while three big-ish choices together don't.
- **Cable Tunnel (3)**: mid-cost, and carries the powered-door demonstration,
  so it needs to be a circuit players deliberately choose to energize
  rather than one that's on by default.
- **Staff Quarters (2)** / **Archive (2)**: the "cheap extras" that make the
  remaining-capacity math come out unevenly (9, not a clean multiple of
  4), so there's always a leftover unit or two that doesn't quite cover
  the next circuit — the friction that makes trade-offs feel real rather
  than arithmetic.

Note that Control Room (4) + Rooftop (4) + Emergency (1) = 9 does fit with
one unit to spare, and is a perfectly valid alternative playstyle (deck the
antenna out with lights, still power the receiver) — the balance isn't
about making any one "correct" loadout, it's about making _every_ loadout a
choice.
