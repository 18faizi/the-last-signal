# The Last Signal

A browser-based atmospheric first-person mystery game set inside an abandoned
telecommunications relay station in northern Pakistan. Built with Babylon.js
and TypeScript.

## Current milestone: 0.8 — Antenna Alignment

Milestones 0.1–0.4 established the engine foundation, first-person controller,
interaction framework, and the door/lock/key/inventory system. Milestone 0.5
added the full greybox layout of the facility (9 zones, 6 doors, 7 pickups),
a monotonic progression phase state machine, zone trigger detection via AABB
polling, checkpoint and teleport registries, F8 teleport menu and F9 facility
debug overlay, static validator for level-design integrity (duplicate IDs,
softlock detection), and the `facility-greybox` boot scene.

Milestone 0.6 added the facility's electrical power network: a generator
startup sequence (nine-state machine, real hold-to-start, warm-up), a
capacity-limited distribution panel routing power across seven circuits from
two sources (generator + emergency battery), powered world state (indicator
lights, a combined inventory+power door), and F10 power debug tooling. See
`docs/architecture/power-network.md` and `docs/level-design/facility-power-plan.md`.

Milestone 0.7 replaces M0.6's provisional one-shot "activate receiver" with
a real frequency-tuning puzzle: a pure-TypeScript signal-evaluation domain
(deterministic quality math with circular phase handling and multiplicative
channel/frequency gating), a receiver device state machine (boot, tuning,
scan, lock, decode), a full-screen tunable receiver panel with canvas
spectrum/waveform visualizations, a decoded-transcript reader, and F11
signal debug tooling. See `docs/gameplay/signal-receiver.md` and
`docs/architecture/signal-domain.md`.

Milestone 0.8 adds rooftop antenna alignment, waveguide routing, and the
source-bearing-analysis reveal that the anomalous transmission has no
valid external bearing: three pure-TypeScript domains
(`src/game/antenna/`, `src/game/waveguide/`, `src/game/source-analysis/`),
a real mechanical antenna panel (array selection, frame-rate-independent
azimuth/elevation/polarization movement, a per-array quality ceiling), a
waveguide junction-box routing puzzle, deterministic (non-randomized)
per-array bearing profiles feeding a cross-array comparison, a dedicated
`AntennaProgressionPhase`/`AntennaRuntimeState`, and F2 antenna debug
tooling. See `docs/gameplay/antenna-alignment.md` and
`docs/architecture/antenna-domain.md`.

### Controls (facility greybox scene)

Click the canvas to capture the mouse (Esc releases). `WASD` move ·
`Shift` sprint · `C`/`Ctrl` crouch · `Space` jump · `E` interact ·
`HOLD E` on the generator starter · `R` respawn to last checkpoint (or reset
tuning controls while the receiver panel is open) · `F7` respawn to spawn ·
`F8` teleport menu (dev) · `F9` facility debug overlay (dev) · `F10` power
network debug overlay (dev) · `F11` signal/receiver debug overlay (dev) ·
`F2` antenna/bearing debug overlay (dev) · `` ` ``/`F3` engine debug
overlay (dev) · `F4` player debug (dev) · `F6` interaction-ray debug (dev).
While the receiver panel is open: `Up/Down` (or `W/S`) select a control
row, `Left/Right` (or `A/D`, hold `Shift` for fine adjustment) adjust it,
mouse wheel adjusts the selected row, `Enter/Space` toggles scan (or opens
the transcript once decoded), `Escape` closes the panel (or just the
transcript, if open). While the antenna panel is open: `W/S` select a row
(array/azimuth/elevation/polarization), `A/D` (`Shift` for fine) adjust
it, `Enter` collects a source-analysis sample (or runs the comparison once
all 3 are collected), `R` parks the selected array, `Space` emergency
stops it, `Escape` closes the panel.

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
- `src/game/power/`, `src/game/generator/`, `src/game/electrical/` — the
  power domain (Milestone 0.6): `PowerNetwork` (sources/circuits/loads,
  atomic capacity allocation), `GeneratorController` (nine-state startup
  machine), breakers, the distribution panel controller, emergency-power
  handoff, and `PoweredStateBinding` — see `docs/architecture/power-network.md`.
- `src/game/signal/`, `src/game/receiver/` — the signal/receiver domain
  (Milestone 0.7): `SignalEvaluator` (pure, deterministic quality math),
  `SignalLockController`/`DecodeController` (frame-rate-independent
  accumulators), `ReceiverController` (device state machine, scan sweep),
  and a dedicated `SignalProgressionPhase`/`ReceiverRuntimeState` — see
  `docs/architecture/signal-domain.md`.
- `src/game/antenna/`, `src/game/waveguide/`, `src/game/source-analysis/`
  — the antenna alignment / waveguide routing / bearing analysis domains
  (Milestone 0.8): `AntennaEvaluator` (pure quality math — circular
  azimuth, linear elevation, 180°-periodic polarization),
  `AntennaController` (per-array mechanical + control state, frame-rate-
  independent movement), `WaveguideController` (route/continuity),
  `BearingEvaluator`/`SourceAnalysisController` (deterministic, authored
  per-array bearing profiles + cross-array comparison), a composition
  evaluator combining M0.7's receiver quality with M0.8's antenna/
  waveguide/power quality, and a dedicated `AntennaProgressionPhase`/
  `AntennaRuntimeState` — see `docs/architecture/antenna-domain.md`.
- `src/ui/` — DOM loading screen, fatal-error screen, inventory viewer,
  (`src/ui/power/`) the distribution panel dialog and compact power/generator
  status widgets, (`src/ui/signal/`) the receiver panel, canvas
  spectrum/waveform visualizations, and transcript reader, and
  (`src/ui/antenna/`) the antenna control panel, alignment meters,
  waveguide status, bearing display, and source-analysis view.

Details in `docs/architecture/`.

## Current limitations

- No gameplay systems beyond traversal and interaction (by design — see milestone scope).
- Settings are not persisted.
- The asset manifest is empty; only the loading/caching machinery exists.
- Babylon Inspector is not bundled.
- No adaptive quality; only a device-pixel-ratio cap.
- No camera feel effects (bob/sway/FOV) — deliberately deferred.

## Next milestone boundary

Milestone 0.9 — not yet started. The antenna alignment, waveguide
routing, and source-bearing-analysis reveal from 0.8 (deliberately scoped
to the "no valid external bearing / local loop" classification only — no
threat AI, no endings, no final story content, no final audio, no save
persistence) are the stable foundation the next content pass will build
on.
