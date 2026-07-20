# The First Threat Encounter

The one complete encounter of Milestone 0.9 (`fg-encounter-first-contact`)
runs entirely inside the control building and is sequenced by four authored
director events (see `docs/level-design/reactive-event-sequence.md`).

## Flow

1. **Rooftop aftermath (Event A).** Immediately after the M0.8 antenna
   reveal resolves, a warning light blinks, and a distant silhouette stands
   briefly at the stairwell top. It disappears when obscured or after 6 s.
   No pursuit — pure atmosphere.
2. **Disturbance (Event B).** Returning into the control room: the corridor
   light drops out, the entrance door swings closed, the duty phone blinks,
   and a presence crosses the far end of the room.
3. **Encounter begins (Event C).** The encounter checkpoint
   (`fg-cp-encounter-start`) activates, hiding prompts arm, and the threat
   itself activates Unaware on the relay level, patrolling down the
   stairwell. From here everything is systemic: your real footsteps and
   noise drive its suspicion; stillness and hiding keep you safe.
4. **Investigation.** Noise brings the threat to the nearest graph node,
   where it pauses and observes; hidden or motionless players are passed
   over, and it sweeps the authored search nodes before withdrawing. If it
   withdraws while the encounter is unresolved, a repeatable keeper event
   re-activates it after a beat.
5. **Detection and pursuit.** Sustained visibility fills the detection meter
   and starts the single controlled pursuit. The threat is slower than your
   sprint, loses you when line of sight breaks for 3.5 s, cannot open locked
   doors and refuses to enter safe zones.
6. **Resolution (Event D).** Reaching the lobby safe zone resolves the
   encounter: the threat withdraws for good (Inactive), the corridor light
   returns, and `THREAT FOUNDATION COMPLETE` is shown. The encounter never
   replays (one-shot events + Inactive actor); the dev reset (F1 tooling /
   test bridge) can replay it.

## Failure

Being caught (capture radius 1.1 m, never while hidden or safe) fades the
screen, prints `ENCOUNTER RESET`, returns you to the encounter checkpoint
and resets ONLY threat/encounter-local state — inventory, power, signal,
antenna progression and all other doors are structurally preserved
(`ThreatEncounterRules.EncounterResetPlan` enumerates everything touched).
No lives, no death screen, no scene reload.
