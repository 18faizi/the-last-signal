# The Last Signal

A browser-based atmospheric first-person mystery game set inside an abandoned
telecommunications relay station in northern Pakistan. Built with Babylon.js
and TypeScript.

## Current milestone: 0.5 — Facility Greybox and Progression Skeleton

Milestones 0.1–0.4 established the engine foundation, first-person controller,
interaction framework, and the door/lock/key/inventory system. Milestone 0.5
adds the full greybox layout of the facility (9 zones, 6 doors, 7 pickups),
a monotonic progression phase state machine, zone trigger detection via AABB
polling, checkpoint and teleport registries, F8 teleport menu and F9 facility
debug overlay, static validator for level-design integrity (duplicate IDs,
softlock detection), and the `facility-greybox` boot scene.

### Controls (facility greybox scene)

Click the canvas to capture the mouse (Esc releases). `WASD` move ·
`Shift` sprint · `C`/`Ctrl` crouch · `Space` jump · `E` interact ·
`R` respawn to last checkpoint · `F7` respawn to spawn · `F8` teleport
menu (dev) · `F9` facility debug overlay (dev) · `` ` ``/`F3` engine debug
overlay (dev) · `F4` player debug (dev) · `F6` interaction-ray debug (dev).

## Requirements

- Node.js >= 20
- pnpm 10 (`corepack enable` or `npm i -g pnpm`)
- A browser with WebGL2 (WebGPU used automatically where available)

## Installation

```bash
pnpm install
```

## Development

```bash
pnpm dev          # start the Vite dev server
```

Open the printed URL. You should see the loading screen, then the development
scene with a sphere falling onto the ground plane, and the marker
`Milestone 0.1 — Foundation Ready`. Press `` ` `` (backquote) or `F3` to
toggle the debug overlay (development builds only).

## Testing

```bash
pnpm typecheck    # TypeScript strict checks
pnpm lint         # ESLint
pnpm format:check # Prettier
pnpm test         # Vitest unit tests
pnpm test:e2e     # Playwright browser smoke test (Chromium)
pnpm check        # all non-destructive quality checks + build
```

## Production build

```bash
pnpm build        # outputs a static site to dist/
pnpm preview      # serve dist/ locally
```

The build is fully static (no server runtime) and deploys to Vercel via the
included `vercel.json`. See `docs/production/deployment.md`.

## Architecture summary

- `src/main.ts` — minimal entry point: locate DOM, build context, start app.
- `src/app/` — `GameApplication` orchestrator, explicit `ApplicationContext`
  (no globals), lifecycle state machine, disposal primitives.
- `src/core/` — services: engine factory (WebGPU→WebGL fallback), scene
  manager, Havok physics service, input manager, audio buses (Howler), typed
  asset manifest/manager, debug overlay, typed error system.
- `src/state/` — Zustand vanilla stores for coarse application/settings
  state. No Babylon objects, no per-frame data.
- `src/game/` — gameplay systems: the first-person player controller
  (kinematic Havok character motor, camera rig, pointer lock, movement
  intent), the interaction framework (targets, registry, raycasting, hold,
  inspection, documents — see `docs/gameplay/interaction-framework.md`)
  and the dev-only test bridge.
- `src/scenes/` — scene definitions: `facility-greybox` (boot scene,
  Milestone 0.5), `access-test` (Milestone 0.4), `interaction-test`
  (Milestone 0.3), `movement-test` (grey-box traversal course) and
  `development` (Milestone 0.1 physics smoke scene).
- `src/game/facility/` — progression system: `ProgressionPhase`,
  `FacilityRuntimeState`, `ZoneRegistry`, `TriggerVolumeSet`,
  `CheckpointRegistry`, `TeleportRegistry`, `FacilityValidator`.
- `src/ui/` — DOM loading screen and fatal-error screen.

Details in `docs/architecture/`.

## Current limitations

- No gameplay systems beyond traversal and interaction (by design — see milestone scope).
- Settings are not persisted.
- The asset manifest is empty; only the loading/caching machinery exists.
- Babylon Inspector is not bundled.
- No adaptive quality; only a device-pixel-ratio cap.
- No camera feel effects (bob/sway/FOV) — deliberately deferred.

## Next milestone boundary

Milestone 0.6 — Narrative Layer. Story text, ambient audio, save/load,
main menu. The greybox geometry and all progression systems from 0.5 are
the stable foundation it will build on.
