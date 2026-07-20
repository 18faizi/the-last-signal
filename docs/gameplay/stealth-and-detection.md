# Stealth and Detection

## The two-stage model

Awareness is two explicit meters, both 0-1, both frame-rate independent
(delta clamped to the codebase's 0.1 s precedent):

1. **Suspicion** rises from _pressure_ — the sum of the vision score and the
   perceived sound pressure — and decays without stimulus. Crossing authored
   thresholds escalates Unaware → Suspicious (0.3) → Investigating (0.7);
   dropping below 0.12 relaxes back to Unaware.
2. **Detection** rises only while the _vision score_ is above an authored
   floor (0.35): sound alone can provoke an investigation but can never
   confirm a detection. Detection decays, and decays much slower for a while
   after line of sight breaks (the threat "remembers"). Reaching 1.0 fires
   the one-shot **full detection** — exactly once per encounter — and begins
   the pursuit.

## The vision score

A pure product of authored factors (see `threat-perception.md`):

- hard windows: max view distance (18 m), horizontal FOV (120°), vertical
  tolerance (2.2 m — different floors never see each other), LOS occlusion;
- graded factors: distance falloff beyond 6 m, lighting exposure,
  movement multiplier (sprint 1.0 > walk 0.7 > crouch/still 0.35),
  peripheral penalty (outer third of the cone ×0.45), behind = 0;
- overrides: a fully-hiding spot forces the score to exactly 0.

## Exposure

A restrained 0-1 lighting approximation, not lux physics: powered, lit zones
read as 1.0; emergency lighting 0.55; darkness 0.3; crouching ×0.75; partial
hiding concealment scales it toward 0.

## Sound

Movement emits typed stimuli: walking footsteps (radius 8 m), sprint
footsteps (16 m, louder), jump landings (12 m). Doors, the generator startup
(a large 45 m stimulus) and receiver/antenna activity emit stimuli through
narrow adapters. Crouched movement is silent. Stimuli attenuate linearly and
expire after ~1 s.

## Practical play

- Crouch in darkness to stay effectively invisible.
- Sound carries between floors; sprinting under an investigating threat is
  how the first encounter usually begins.
- Full hiding spots (cabinet, locker) are absolute against vision, but loud
  stimuli still raise suspicion while hidden, and entering a spot in full
  view does not erase what the threat already suspects.
- Pursuit speed (4.2 m/s) is slower than the player sprint (5.4 m/s): a
  detected player can always outrun the threat to a safe zone.
