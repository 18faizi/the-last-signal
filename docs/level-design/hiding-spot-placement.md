# Hiding Spot Placement

Four spots cover the encounter route so a player is never more than ~8 m
from cover (`FACILITY_HIDING_SPOTS`; geometry in `buildHidingSpots.ts`):

- **Equipment cabinet** (relay room east wall, floor 1) — full concealment
  against the patrol start; open-fronted shell, camera looks west along the
  corridor.
- **Maintenance locker** (control room west wall, near the stairwell
  bottom) — full concealment exactly where the threat descends; the
  canonical "let it pass" spot for the first investigation.
- **Under the comms desk** (control room center) — partial (0.85): fast to
  reach mid-room, low crouched camera, wider look cone, but not absolute.
- **Dark alcove** (relay room west end, floor 1) — partial (0.9): covers a
  retreat back upstairs.

Shells are decorative, physics-free meshes (the hidden player's collider is
parked INSIDE them at the authored `colliderPosition`), but they remain
pickable so the threat's LOS probe treats them as real occluders — a hidden
player is occluded both by data (concealment) and by geometry.

Camera/collider/entry/exit points are authored per spot and validated, so
the hiding transition can never clip, and exit restores the pre-hide
transform exactly.
