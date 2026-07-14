# Player controller (Milestone 0.2)

## Responsibilities

```
FirstPersonController            per-scene composition root; per-frame update
  ├─ PointerLockController       prompt overlay, lock acquisition/release
  ├─ CameraRig                   yaw/pitch, eye-height smoothing, camera follow
  ├─ MovementIntent (pure)       raw keys → normalized axes + held/edge actions
  ├─ PlayerMotor                 physics: velocity model, stance, probes
  │    ├─ PhysicsCharacterController (Babylon/Havok, kinematic)
  │    ├─ CrouchState (pure)     stance state machine
  │    └─ JumpTiming (pure)      coyote time + jump buffering
  └─ PlayerDebugVisualizer       dev-only F4 wireframes (collider + probes)
```

- The **camera never defines collision**: `CameraRig` copies the motor's foot
  position each frame and adds the smoothed eye height. Roll is always 0.
- The **collider never rotates**: the Havok character controller is a
  kinematic capsule that translates only. Yaw lives on the camera; the
  controller converts intent into a camera-relative horizontal velocity.
- The controller is scene-agnostic and reusable: spawn point, overlay parent
  and stores arrive via `SceneCreationContext`; nothing references the
  movement-test course.

## Physics approach

**Chosen motor: Babylon's `PhysicsCharacterController`** (Havok-backed
kinematic character proxy, `@babylonjs/core/Physics/v2/characterController`).

Why: it is the officially supported kinematic character controller for the
installed Babylon 9.16 / Havok 1.3 pair, and it provides exactly the
guarantees this milestone needs natively — contact-manifold shape casting
with penetration recovery (`keepDistance`/`penetrationRecoverySpeed`), slope
limiting (`maxSlopeCosine`), a strict step-height cap (`maxStepHeight` +
`footOffset`), support queries (`checkSupport`), runtime shape swap (crouch)
and teleport (`setPosition`). The rejected alternatives: a dynamic rigid
body needs constant fighting against tipping/impulses; a hand-rolled
shape-cast motor re-implements the simplex solver the Havok proxy already
has.

The motor owns the velocity model; Babylon's `calculateMovement` helper is
not used because acceleration/deceleration tuning is game-specific:

- **Grounded**: horizontal velocity moves toward the commanded target at
  `groundAcceleration` (driving) or `groundDeceleration` (stopping), then is
  projected onto the ground plane (preserving speed) so slopes track the
  surface. When idle, velocity is set to exactly zero and no gravity is
  integrated — supported characters cannot creep down walkable slopes.
- **Airborne**: gravity integrates explicitly (`gravityY * dt`;
  `integrate()`'s gravity parameter only shapes impulses applied to dynamic
  bodies, it does not accelerate the character). Air control accelerates at
  `airAcceleration` toward a target capped at `maxAirControlSpeed`, so
  sprint-jump momentum decays instead of growing.
- After `integrate()`, the solver's clipped velocity is adopted as
  authoritative — a jump into a ceiling cannot carry impossible upward
  velocity into the next frame.

### Ground detection

`checkSupport(dt, down)` returns `SUPPORTED`/`SLIDING`/`UNSUPPORTED` plus the
averaged surface normal — grounded state is _not_ inferred from vertical
velocity. Transitions produce `justLanded`/`justLeftGround` flags; landing
clamps any residual downward velocity (no bounce). A narrow single raycast
(player→WORLD filter) below the foot supplies ground distance, normal and
slope angle for debug output.

### Slopes

`maxSlopeCosine = cos(46°)`. Contacts steeper than that are treated as walls
by the solver (upward movement is rejected); `checkSupport` reports SLIDING
and the motor applies gravity, producing a controlled slide. Walkable-slope
descent stays grounded because grounded velocity is projected onto the
surface plane rather than pointed horizontally into the air.

### Steps

`maxStepHeight = 0.35` with `footOffset = capsuleHeight/2`. The controller's
step-up sweep (up→forward→down shape casts) climbs obstacles whose top is at
most 0.35 m above the foot and demotes taller "walkable" contacts to wall
constraints, so the capsule's rounded bottom cannot glide over the limit.
Step-up triggers only against static geometry, teleports without adding
vertical momentum, and cannot ratchet up walls (the landing must be a
walkable surface measurably above the start).

### Crouch resizing

Two capsule shapes are created once (standing 1.8 m, crouched 1.2 m; shared
radius 0.35 m). Crouching swaps `controller.shape` and repositions the
capsule center so the **foot stays planted** — resizing can never push the
player through floor or ceiling, and being kinematic it produces no
impulses. The stance state machine distinguishes `standing`, `crouched` and
`stand-blocked` (crouch released but no head room); "crouch requested" is
the raw held input, visible in the debug overlay.

### Head clearance

Five upward raycasts (center + four rim points at 0.7 × radius) from the top
of the crouched capsule, spanning the extra height the standing capsule
needs plus `headClearanceMargin` (0.05 m). Any hit blocks standing. Rays use
the player→WORLD collision filter, so the player's own capsule is invisible
to them.

### Jumping

Jump fires on **press edges only** (queued from InputManager keydown events,
so a press shorter than one frame still registers). `JumpTiming` implements
configurable coyote time (100 ms) and jump buffering (100 ms); consuming a
jump clears both windows, making double-jumps impossible. Jumps set vertical
velocity to `jumpVelocity` (4.4 m/s ⇒ ~0.99 m apex).

## Input mapping

| Action                             | Default binding            |
| ---------------------------------- | -------------------------- |
| Move forward / back / left / right | `W` `S` `A` `D`            |
| Sprint (hold)                      | `ShiftLeft` / `ShiftRight` |
| Crouch (hold)                      | `ControlLeft` / `C`        |
| Jump                               | `Space`                    |
| Reset to spawn (dev)               | `R`                        |
| Toggle debug overlay               | `` ` `` / `F3`             |
| Toggle debug visualization         | `F4`                       |

Raw input stays in `InputManager`; `MovementIntent` converts pressed-key
sets into normalized axes (opposing keys cancel, diagonals normalize to
length 1) and edge flags. **Backward sprint is disabled by design** — sprint
requires forward-dominant input (`moveZ > 0.1`), fitting the game's
deliberate pacing; sideways-only sprint is likewise rejected.

## Pointer-lock lifecycle

1. The scene shows a keyboard-focusable prompt: _Click to enter movement test_.
2. Clicking the canvas or activating the prompt (click/Enter/Space) requests
   pointer lock — never automatically on load.
3. While locked, pointer deltas drive yaw/pitch; Escape releases via native
   browser behavior (observed through `pointerlockchange`).
4. Lock loss or window blur zeroes movement intent (gravity and deceleration
   continue so the player settles); the prompt reappears.
5. Request errors resolve to the unlocked state; nothing throws.
6. All listeners and the prompt DOM are disposed with the scene.

## Tuning values

See `src/game/player/PlayerConfig.ts` (single source). Current defaults:
capsule r 0.35 / H 1.8 / crouched 1.2; eyes 1.66 / 1.06; walk 3.2, sprint
5.4, crouch 1.6 m/s; ground accel 22, decel 28, air accel 6, air cap 3.2
m/s²·⁻¹; jump 4.4 m/s; gravity −9.81; slope 46°; step 0.35 m; crouch
transition 0.22 s; probes 0.6 m ground / 0.05 m clearance margin; look base
0.0022 rad/px, pitch ±89°; out-of-bounds Y −12; dt clamp 50 ms.

## Known limitations

- The head-clearance probe is a 5-ray approximation, not a true shape cast;
  a thin spike narrower than the ray spacing could theoretically be missed.
- `SLIDING` on steep slopes uses air-style control, so slide feel is
  functional rather than tuned.
- Landing exactly on a steep/flat seam can briefly report SLIDING before
  settling; no visible artifact in the test course.
- Respawn forces the standing stance (spawn areas are authored with
  standing room).

## Future extension points

- `MovementIntent` is where gamepad/touch input converges later.
- `PlayerMotor.motorState` (+ `justLanded`/mode) is the hook for footsteps,
  landing audio and camera feel effects in later milestones.
- A gameplay scene reuses `FirstPersonController` by passing its own spawn
  and overlay parent; nothing in `src/game/player` references the test course.
