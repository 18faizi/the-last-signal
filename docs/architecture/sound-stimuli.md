# Sound Stimuli

`src/game/threat/perception/SoundStimulus.ts` +
`SoundStimulusRegistry.ts`. No actual audio is involved — stimuli are typed
plain-data records for the AI only.

## Record shape

id, position, intensity (0-1), radius (m), category (`footstep-walk`,
`footstep-sprint`, `jump-landing`, `door-operation`, `generator-startup`,
`signal-activity`), monotonic seq, registry-clock timestamp, duration,
source (`player`/`door`/`generator`/`receiver`/`antenna`/`dev`),
`aiReactable` flag, optional zone id.

## Registry semantics

- The clock is accumulated from update deltas (no `Date.now()` in
  correctness paths) — deterministic under test.
- Expiry is a single linear sweep with swap-remove over a small bounded
  array (stimuli are rare, short-lived events).
- `strongestFor(listener)` answers perception's one question: the highest
  `perceivedIntensity` (linear attenuation, zero at radius) among
  AI-reactable stimuli; ties resolve to the newest seq — deterministic.
- `clearStimuli()` (encounter reset) drops live stimuli but keeps the clock;
  `reset()` (dev full reset) restores everything; listeners survive both.
- Expiry is ticked from the bindings' always-on lightweight observer so
  stimuli emitted while the threat is dormant still expire on schedule.

## Authored volumes

| stimulus                  | intensity | radius                 |
| ------------------------- | --------- | ---------------------- |
| walk footstep             | 0.35      | 8 m                    |
| sprint footstep           | 0.7       | 16 m                   |
| jump landing              | 0.6       | 12 m                   |
| door operation            | 0.55      | 12 m                   |
| generator startup         | 1.0       | 45 m (large, authored) |
| receiver/antenna activity | 0.5-0.6   | 12-14 m                |
