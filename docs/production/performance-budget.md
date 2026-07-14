# Performance budget (provisional)

Preliminary targets for the finished game. These are budgets to design
against, not current measurements; they will be revisited when real scenes
exist.

## Payload

| Budget                          | Target                                                           |
| ------------------------------- | ---------------------------------------------------------------- |
| Initial compressed page payload | ≤ 5 MB (engine + app code, gzip/brotli)                          |
| Total per-scene asset budget    | ≤ 25 MB compressed                                               |
| Single texture                  | ≤ 2048×2048; 1024² preferred; KTX2/basis when the pipeline lands |
| Audio                           | streamed music; SFX ≤ 200 KB each                                |

Note: Milestone 0.1 imports Babylon via subpath imports, which keeps the
initial bundle well under budget (≈ 1.8 MB raw / ≈ 0.4 MB gzip today).

## Runtime

| Budget                 | Target                                                         |
| ---------------------- | -------------------------------------------------------------- |
| Minimum FPS            | 60 on a mid-range desktop GPU; 30 floor on integrated graphics |
| Frame budget           | ≤ 16.6 ms (≤ 8 ms render, ≤ 4 ms physics, remainder headroom)  |
| Draw calls per frame   | ≤ 150                                                          |
| Active lights          | ≤ 4 per scene (plus one shadow-casting)                        |
| Shadow casters         | ≤ 1 shadow generator, ≤ 30 casters                             |
| Total meshes per scene | ≤ 500 (with instancing for repeats)                            |

## Memory

- Target < 1 GB total browser memory on desktop.
- Textures are the dominant cost: enforce the texture budget above and
  dispose scene assets on scene transitions (AssetManager disposal hook).
- Watch for Babylon observer/mesh leaks across scene transitions — the
  `SceneHandle.dispose` contract exists to prevent them.

## How frame time will be monitored

Milestone 0.1 exposes FPS (engine.getFps) in the debug overlay. A later
milestone will add `EngineInstrumentation`/`SceneInstrumentation` sampling
(GPU frame time, inter-frame time, draw calls) aggregated into rolling
percentiles, surfaced in the overlay and used by the adaptive-quality
manager to step the hardware scaling level and effect tiers.

## Current groundwork in code

- Device pixel ratio capped at 2 (`performanceConfig.maxDevicePixelRatio`).
- Debug overlay updates on a timer, never per frame.
- Render loop allocates nothing per frame (scene lookup only).
- Zustand stores exclude per-frame data by policy.
