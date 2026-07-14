# Manual test checklist — Milestone 0.2 movement

Run `pnpm dev`, open the printed URL, wait for the loading screen to clear.
Open the browser console first; it must stay free of errors throughout.

Legend: `[ ]` unchecked / `[x]` verified.

## Pointer lock

- [ ] The prompt "Click to enter movement test" is visible and centered.
- [ ] Tab focuses the prompt; Enter or Space activates it (keyboard path).
- [ ] Clicking the canvas captures the mouse; the prompt disappears.
- [ ] Escape releases the lock; the prompt reappears; movement stops.
- [ ] Clicking again reacquires the lock.

## Mouse look

- [ ] Moving the mouse rotates the view; roll never occurs.
- [ ] Looking straight up/down stops at the pitch clamp (~±89°) without flipping.
- [ ] `__TLS_TEST__.setMouseSensitivity(3)` in the console makes look faster;
      `(1)` restores it. (Dev-only bridge; see testing.md.)
- [ ] `__TLS_TEST__.setInvertY(true)` flips vertical look; `(false)` restores.

## Walking / sprinting

- [ ] `W A S D` move camera-relative; opposing keys cancel.
- [ ] Speed ramps up briefly rather than starting at full speed; releasing
      keys coasts to a stop within a fraction of a second.
- [ ] Diagonal movement (`W`+`D`) is no faster than straight movement
      (debug overlay `H speed` shows ≤ walk speed).
- [ ] Holding `Shift` + `W` sprints (overlay Mode: `sprinting`, speed 5.4).
- [ ] Sprint does not engage while crouched, stationary, or moving backward.

## Crouching

- [ ] Holding `C` (or left Ctrl) crouches: eye height lowers smoothly,
      Mode shows `crouching`, speed caps at crouch speed.
- [ ] Releasing `C` stands smoothly when there is head room.
- [ ] In the CROUCH TUNNEL: enter crouched, release `C` inside — the player
      stays crouched and the overlay Crouch row shows `BLOCKED`.
- [ ] Walk out of the tunnel with `C` released — standing resumes promptly.
- [ ] The camera never clips through the tunnel ceiling or the floor.

## Jumping / gravity

- [ ] `Space` jumps only when grounded; holding Space does not re-jump.
- [ ] Jump onto the JUMP 0.90m platform succeeds.
- [ ] Landing is dead — no bounce, no camera jitter.
- [ ] Walking off the DECK drop falls under gravity and lands stably.
- [ ] Air control: direction can be adjusted mid-jump but is clearly weaker.

## Ramps (west side)

- [ ] RAMP 15°: walk up and down; grounded stays stable; no floating on descent.
- [ ] RAMP 40°: still climbable (at/near the 46° limit).
- [ ] RAMP 60°: upward movement is rejected / player slides back down.
- [ ] Standing idle on the 15° ramp: the player does not creep downhill.

## Steps (center)

- [ ] STEP 0.15m: crossed smoothly without jumping, no camera snap.
- [ ] STEP 0.32m: crossed (near the 0.35 limit).
- [ ] STEP 0.60m: blocked — walking into it does not climb it.

## Collision

- [ ] Perimeter walls, pillars and corridor walls cannot be passed through.
- [ ] NARROW CORRIDOR (1.0 m) is walkable without snagging.
- [ ] Sliding along walls at shallow angles is smooth (no sticking).

## Recovery

- [ ] Walk through the south OUT OF BOUNDS gap; after falling below the
      threshold the player respawns at the start, standing, with zero velocity.
- [ ] `R` resets to spawn at any time (development builds).

## Window / viewport

- [ ] Alt-Tab away while holding `W`: on return the player has stopped (no
      stuck keys) and pointer lock is released.
- [ ] Resizing the window keeps the render undistorted and the overlay usable.
- [ ] Browser zoom 80–125%: prompt and overlays remain readable/usable.

## Debug tooling

- [ ] `` ` `` / `F3` toggles the overlay; player rows update (position,
      speeds, mode, grounded, ground distance, slope, crouch, pointer lock,
      yaw/pitch).
- [ ] `F4` toggles collider/probe wireframes: capsule follows the player and
      swaps size when crouching; ground probe (yellow), clearance probe
      (teal, red when stand-blocked), movement direction (green), ground
      normal (magenta). Wireframes never collide with the player.
- [ ] `pnpm build && pnpm preview`: production build shows NO debug overlay,
      no F4 visuals, and `window.__TLS_TEST__` is undefined.
