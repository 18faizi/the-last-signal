# Object inspection

## Representation

The inspected object is a **fresh primitive assembly built by the target**
(`InspectableTarget.buildInspectionModel(scene)`), parked at a rig position
far above the playable area (0, 500, 0) in the same scene. The world mesh
is never moved, cloned-in-place or detached; the model has no physics and
cannot collide. A dedicated `TargetCamera` views the rig center and a
dedicated `HemisphericLight` with `includedOnlyMeshes` guarantees the model
reads against the dark clear color. The DOM `InspectionOverlay` dims the
scene edges and shows the name, description and control hints.

**Camera/light reuse:** both are created lazily on the first session and
reused for every later one — repeated open/close cycles add no cameras,
lights, observers or DOM nodes (verified by the automated 20× leak test).
`scene.activeCamera` swaps to the inspection camera for the session and is
restored on close. No second render loop exists at any point.

## Pointer-lock strategy (documented decision)

Inspection **keeps pointer lock** and reroutes the frame's mouse deltas
from camera look to model rotation (free pointer movement, not
drag-to-rotate — with a locked pointer there is no cursor to drag).
Escape exits pointer lock natively; the controller interprets that lock
loss as "close inspection", so Escape works even though browsers do not
deliver an Escape keydown while locked. In dev bypass mode an explicit
Escape listener closes the session instead. After closing, the standard
"click to enter" flow re-locks — the same flow used at scene start, so
re-acquisition can never produce a camera jump (the player controller also
drops the first delta after any relock).

## Controls

| Input          | Effect                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Mouse movement | rotate model (yaw unbounded, pitch clamped ±80°)                                                            |
| Mouse wheel    | zoom camera radius, clamped 0.7–2.4 m                                                                       |
| `R`            | reset orientation and zoom (dev respawn `R` is suppressed while input is locked — mode routing, never both) |
| `Escape`       | close                                                                                                       |

Rotation math is pure (`InspectionOrientation.ts`) and unit-tested:
sensitivity 0.006 rad/px, initial radius 1.3 m, zoom 0.0022 m per wheel
unit.

## Lifecycle

`open(target)` acquires an input lock (locomotion + look suspend), builds
the model, swaps the camera, shows the overlay. `close()` (Escape, lock
loss, scene disposal, dev bridge) disposes the model with its materials,
restores the previous camera, hides the overlay and releases the lock.
Failed setup runs the same teardown before rethrowing, so the player is
never left frozen. The player returns to the exact prior position and look
orientation because the gameplay camera was never touched.
