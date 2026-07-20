# Threat Presence

Milestone 0.9 introduces a restrained, reactive threat presence to the
facility. There is exactly one threat actor ("Unknown Presence") and it is
deliberately quiet: most of what the player experiences early on are
**manifestations** — staged, non-interactive beats (a distant silhouette, a
presence crossing a corridor, a light dropping out, the duty phone blinking)
that are separate from the actor itself.

## Design principles

- **Restraint over spectacle.** The threat is dormant for the entire game
  until the antenna reveal (M0.8) completes. Before that moment it costs
  zero per-frame work and cannot appear.
- **No omniscience.** The threat only knows what its perception model tells
  it: line of sight, distance, lighting exposure, player movement noise and
  authored sound stimuli. It never reads the player's position directly.
- **No combat.** There is no health, damage, gore or death screen. The only
  failure is being caught, which fades the screen, shows `ENCOUNTER RESET`
  and returns the player to the encounter checkpoint with all major
  progression intact.
- **Confinement.** The threat moves only along an authored nav graph inside
  encounter-approved zones (control building interior). It never roams the
  facility and never enters safe zones.

## The threat actor states

Dormant → Manifesting → Observing → Unaware → Suspicious → Investigating →
Searching → Pursuing → LostTarget → Withdrawing → (Dormant | Inactive), with
Fault as a dead-end diagnostic state. See
`docs/architecture/threat-state-model.md` for the full transition table.

## What the player sees

- A detection meter (top center) that appears only once suspicion exists,
  with text states UNSEEN / OBSERVED / SUSPICION / DETECTED / SEARCHING.
- The actor silhouette: a tall, slightly-off human shape in dark, desaturated
  greybox primitives. Provisional by design; no face or creature features.
- Reactive events: lights change, a door closes, the phone blinks — all
  driven by the typed event director (`docs/architecture/event-director.md`).
