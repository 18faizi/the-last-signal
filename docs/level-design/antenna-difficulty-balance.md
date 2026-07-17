# Antenna Difficulty Balance

Tuning values live in `src/scenes/facility-greybox/antenna/
facilityAntennaDefinitions.ts`. All figures below are the shipped values.

|                                            | North Dish        | East Relay Dish                 | Tower Diagnostic Loop |
| ------------------------------------------ | ----------------- | ------------------------------- | --------------------- |
| Role                                       | ExternalCandidate | RelayCandidate                  | DiagnosticLoop        |
| Azimuth target / tolerance / capture width | 15° / ±15° / 30°  | 42° / ±8° / 6°                  | 0° / ±20° / 40°       |
| Elevation target / tolerance               | 25° / ±10°        | 18° / ±6°                       | 15° / ±6°             |
| Polarization target / tolerance            | 10° / ±20°        | -35° / ±12°                     | 0° / ±30°             |
| Base gain                                  | 0.5 (medium)      | 0.8 (high)                      | 0.3 (low)             |
| `maxQuality` ceiling                       | 0.6               | 0.95                            | 0.8                   |
| Required for progression                   | yes               | yes (also `receiverCompatible`) | yes                   |
| Waveguide state at start                   | Connected         | **Misrouted** (the puzzle)      | Connected             |

## Design rationale

- **North Dish** is intentionally the easiest array (widest capture
  width relative to tolerance) so the player's first alignment attempt
  succeeds quickly and teaches the control scheme without frustration —
  but its LOW `maxQuality` ceiling means it can never contribute a strong
  reading, reinforcing (mechanically, not just narratively) that it's the
  "weak, inconclusive" array.
- **East Relay Dish** has the narrowest azimuth capture width (6°) of the
  three, deliberately the hardest alignment in the milestone — it's also
  the array required to carry the actual transmission, so its difficulty
  is earned: getting it right matters mechanically (receiver-compatible),
  not just for the sample.
- **Tower Diagnostic Loop** has the widest tolerances of all three
  (forgiving on every axis) so a player who initially dismisses it as
  irrelevant doesn't lose significant time aligning it once they circle
  back — the puzzle wants its ROLE to be the surprise, not its
  difficulty.

## Mechanical speeds

Azimuth 14-18°/s, elevation 9-12°/s, polarization 20-25°/s across the
three arrays — all within the spec's 12-20°/8-14°/18-30°/s bands. Speeds
were NOT used as a difficulty lever (every array moves at a comparable
pace); difficulty comes entirely from tolerance/capture-width tuning, so
movement always feels equally responsive regardless of which array is
selected.

## Balance validation

`AntennaValidation.ts`'s achievability + default-not-solved checks run at
scene creation for all three arrays (see
`docs/architecture/antenna-validation.md`) — the shipped tolerances are
mechanically provable to be reachable, and the parked default position is
provably NOT already a solution, for every array.
