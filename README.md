# The Last Signal

A browser-based atmospheric first-person mystery game set inside an abandoned
telecommunications relay station in northern Pakistan. Built with Babylon.js
and TypeScript.

## Current milestone: 0.2 — First-Person Controller and Camera Foundation

Milestone 0.1 established the technical foundation (lifecycle, WebGPU→WebGL
fallback, scene management, Havok physics, input/audio/asset infrastructure,
stores, debug tooling, testing, CI). Milestone 0.2 adds a production-quality
first-person controller — pointer-lock mouse look, walking/sprinting/
crouching, jumping, slopes, step traversal, head-clearance checks — inside a
grey-box traversal test course. **There is still no gameplay**: no
interactions, story, enemies, audio content or saves.

### Controls (movement test scene)

Click the canvas to capture the mouse (Esc releases). `WASD` move ·
`Shift` sprint · `C`/`Ctrl` crouch · `Space` jump · `R` respawn (dev) ·
`` ` ``/`F3` debug overlay (dev) · `F4` collider/probe visualization (dev).

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
  intent) and the dev-only test bridge. See
  `docs/architecture/player-controller.md`.
- `src/scenes/` — scene definitions: `movement-test` (boot scene, grey-box
  traversal course) and `development` (Milestone 0.1 physics smoke scene).
- `src/ui/` — DOM loading screen and fatal-error screen.

Details in `docs/architecture/`.

## Current limitations

- No gameplay systems beyond traversal (by design — see milestone scope).
- Settings are not persisted.
- The asset manifest is empty; only the loading/caching machinery exists.
- Babylon Inspector is not bundled.
- No adaptive quality; only a device-pixel-ratio cap.
- No camera feel effects (bob/sway/FOV) — deliberately deferred.

## Next milestone boundary

Milestone 0.3 — Interaction Framework and Object Inspection. Nothing from it
(interaction raycasts, prompts, doors, inventory, item inspection) is
present in this codebase.
