# Scene lifecycle

## Scene definitions

A scene is described by a `SceneDefinition`: an id from the typed `SceneId`
union plus an async `create(context)` factory returning a `SceneHandle`
(`{ scene, dispose() }`). Definitions are registered with the `SceneManager`
at startup — there is no switch statement; adding a scene means adding a
definition module and registering it.

Milestone 0.1 registers exactly one definition: `development`.

## Transition sequence

`SceneManager.load(id, context)`:

1. Rejects unknown ids (typed `scene-create` GameError).
2. Rejects the call if another transition is already in flight.
3. Marks itself transitioning and notifies observers (application store
   mirrors this as `sceneTransition`).
4. Disposes the previous `SceneHandle` — at most one scene is ever alive.
5. Awaits the definition's `create(context)`.
6. Activates the new handle and clears the transitioning flag (also on
   failure, so an error never leaves the manager stuck).

Failures are wrapped in `GameError('scene-create')`, reported through
`ErrorReporter`, and re-thrown to the caller. During startup,
`GameApplication` treats a failed initial scene load as fatal.

## Scene creation context

`create()` receives everything it needs explicitly:

- `engine`, `canvas` — for scene and camera construction
- `physics` — the shared `PhysicsService`; the scene calls
  `enableForScene(scene)` and owns the returned plugin
- `environment` — build-mode info
- `onPhysicsReady` — callback so capability/debug state reflects reality

## Disposal contract

`SceneHandle.dispose()` must release the Babylon scene and anything the
scene registered (camera control, physics plugin, observers). The
development scene detaches camera control, disposes the scene (which
releases meshes/materials/lights) and disposes its Havok plugin instance.
