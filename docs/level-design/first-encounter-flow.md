# First Encounter Flow (Level Design)

Location: the control building interior. The encounter uses three vertical
layers already present in the greybox: the relay level (floor 1, y≈3.1),
the stairwell (NW corner) and the control-room floor (y≈0.1), with the
lobby (z < 16) as the safe-zone endpoint.

## Beats and spaces

1. **Aftermath** — rooftop → relay level. The stairwell-top silhouette is
   visible down the relay corridor; the rooftop warning fixture blinks.
2. **Disturbance** — control room. Corridor light out (concealment up),
   entrance door closed (routing the player deeper), phone blinking on the
   duty desk (a pull toward the lobby side).
3. **Encounter** — the threat patrols relay-mid → stairwell → ctrl-west.
   The dark control room plus four hiding spots (locker + under-desk on
   floor 0, cabinet + alcove on floor 1) give options along the whole route.
4. **Escape** — the pursued player sprints south through the ctrl-south
   doorway node into the lobby safe zone. The doorway is the authored
   pursuit boundary: the threat can reach the node but never crosses.

## Timing

Event A: 2 s after the reveal. B: ≥8 s after A, once inside the control
room, +1.5 s delay. C: ≥5 s after B. The keeper event re-activates a
withdrawn threat 3 s after it goes Dormant while the encounter is active.
All delays are authored constants — no randomness.

## Recoverability

Failure returns the player to `fg-cp-encounter-start` in the middle of the
control room. Doors, lights and the threat return to authored encounter
values; nothing else changes, so the retry loop is under 30 seconds.
