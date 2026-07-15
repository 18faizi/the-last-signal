# The Last Signal

A browser-based atmospheric first-person mystery game set inside an abandoned
telecommunications relay station in northern Pakistan. Built with Babylon.js
and TypeScript.

## Current milestone: 0.3 — Interaction Framework and Object Inspection

Milestone 0.1 established the technical foundation; 0.2 the first-person
controller. Milestone 0.3 adds the reusable interaction language: focus
detection with contextual prompts, immediate and hold-to-interact
activation, object inspection (rotate/zoom an isolated model), a typed
readable-document reader, disabled/blocked states, and interaction
debugging — exercised in a grey-box interaction test room. **Still no
story systems**: no doors, keys, inventory, puzzles, saves, enemies or
audio content.

### Controls (interaction test scene)

Click the canvas to capture the mouse (Esc releases). `WASD` move ·
`Shift` sprint · `C`/`Ctrl` crouch · `Space` jump · `E` interact
(`HOLD E` where prompted) · in inspection: mouse rotate, wheel zoom, `R`
reset, `Esc` close · `R` respawn (dev, gameplay only) · `` ` ``/`F3` debug
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
- `src/scenes/` — scene definitions: `interaction-test` (boot scene),
  `movement-test` (grey-box traversal course) and `development`
  (Milestone 0.1 physics smoke scene).
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

Milestone 0.4 — Doors, Locks, Keys and Contextual Inventory. Nothing from
it (functional doors, key ownership, inventory) is present in this
codebase.
