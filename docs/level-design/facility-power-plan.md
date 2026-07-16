# Facility Power Plan

## Sources

| Source                                        | Capacity | Priority | Available from                                                |
| --------------------------------------------- | -------- | -------- | ------------------------------------------------------------- |
| Facility Generator (`fg-power-src-generator`) | 10       | 10       | Player closes the main breaker after a full startup sequence. |
| Emergency Battery (`fg-power-src-battery`)    | 2        | 1        | Scene boot (automatic).                                       |

## Circuits

| Circuit                | Cost | Emergency-eligible | Loads                                                 | Notes                                                                                              |
| ---------------------- | ---- | ------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Emergency & Security   | 1    | Yes                | Gate emergency light, security floodlight             | Pre-energized from the battery at boot; transferred to the generator once its main breaker closes. |
| Control Room           | 4    | No                 | Control room lights, consoles, **the field receiver** | Required for the milestone's completion trigger.                                                   |
| Generator Auxiliary    | 1    | No                 | Generator hall lights                                 | Powers the room the generator itself sits in.                                                      |
| Cable Tunnel           | 3    | No                 | Tunnel lights, **tunnel maintenance door actuator**   | Combined inventory+power door — see `powered-access.md`.                                           |
| Staff Quarters         | 2    | No                 | Dormitory lights, kitchen lights                      |                                                                                                    |
| Rooftop / Antenna      | 4    | No                 | Antenna deck lights, beacon                           |                                                                                                    |
| Communications Archive | 2    | No                 | Archive lights, archive terminal                      |                                                                                                    |

Total non-emergency cost: 4 + 1 + 3 + 2 + 4 + 2 = **16**. Including the
emergency circuit once it's transferred onto the generator: **17** against a
10-unit generator. See `circuit-capacity-balance.md` for why.

## World placement

- **Generator controls**: north interior wall of the generator hall
  (x ∈ [43.5, 50], z ≈ 5.75), y = 1.6m — aligned to the player's standing
  eye height (1.66m) specifically so a level look lands on each control
  without pitch adjustment. This is what lets the e2e suite drive the
  starter hold through the real interaction framework.
- **Distribution panel + field receiver**: control room, west wall
  (x = -9.7, z = 18 and z = 22 respectively), same eye-height alignment.
- **Indicator lamps**: one per circuit at a representative location in its
  zone (security booth, generator hall, tunnel, staff quarters, rooftop,
  archive) — see `buildPoweredIndicators.ts`.

### Two clearance bugs the real-hold e2e test caught

The eye-height alignment above is necessary but wasn't originally
sufficient — two geometry issues let the raycast miss even though the
mesh, camera, and vantage point were each individually "correct":

1. **Standing clearance**: the two decorative "generator unit" equipment
   blocks (`buildGeneratorBuilding.ts`, physics-colliding) originally
   reached to `z = 5`, and the control vantage line sits at `z = 5.2`. The
   player capsule's `colliderRadius` (0.35) meant the capsule's actual
   collision boundary reached back to `z ≈ 4.85` — a 0.15m overlap. Havok's
   character controller continuously depenetrated the capsule out of that
   overlap every physics step, producing a slow forward/upward drift
   invisible to a quick single-frame check but enough, over the several
   real seconds a hold interaction spans, to walk the camera out of ray
   alignment with the wall controls. Fixed by pulling the blocks' near face
   back to `z = 4.3` (0.55m clear of the capsule's reach).
2. **Vertical margin**: three of the seven generator control boxes
   (battery, e-stop, selector) were built with `height: 0.3` centered on
   `y = 1.6`, giving a top edge at `y = 1.75`. The camera's _actual_ settled
   eye height is a couple of centimetres above the nominal 1.66 (floor
   collision settling adds a small offset), measured at `y ≈ 1.77–1.78` —
   above that top edge, so a level look passed clean over all three boxes.
   The starter control (height 0.4, top edge 1.8) had enough margin for a
   single instantaneous press but not for a sustained multi-second hold,
   where the same kind of slow post-teleport vertical settle can approach
   ~1.81 asymptotically. Fixed by growing battery/e-stop/selector to
   `height: 0.5` and the starter to `height: 0.6`.

Both were caught and root-caused (not just papered over with retries) by
`tests/e2e/power.spec.ts`'s dedicated real-hold test — see
`../development/testing.md`'s "Full power progression test" section for
the full diagnostic trail.
