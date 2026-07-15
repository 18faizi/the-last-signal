# Interaction test scene

`interaction-test` is the current boot scene (Milestone 0.3): a compact
grey-box room whose fixtures exercise every interaction feature. Spawn is
at the south end facing the control console.

## Fixtures

| Fixture                   | Location                         | Exercises                                                                                             |
| ------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Toggle switch             | console, straight ahead of spawn | immediate interaction, indicator change                                                               |
| Multi-state control       | console, left                    | non-boolean state cycling (OFF→STANDBY→ACTIVE→FAULT lamps)                                            |
| Breaker                   | console, right                   | hold-to-interact (1.5 s), non-repeatable completion (`BREAKER READY`)                                 |
| AUX panel                 | console, far right               | disabled state (`REQUIRES POWER`)                                                                     |
| Async terminal            | west table                       | Promise-returning interaction + busy state (600 ms dev delay)                                         |
| Field radio               | west table                       | inspection; knobs/antenna are child meshes resolving to one target                                    |
| Relay component           | east table                       | second inspectable                                                                                    |
| Maintenance note          | east table                       | short readable document                                                                               |
| Shift log                 | west table                       | long, scrollable readable document                                                                    |
| CASED SWITCH behind glass | mid-room right                   | line of sight: the pane is visually transparent but pickable, so the target cannot be used through it |
| PRIORITY PAIR valves      | mid-room left                    | two adjacent targets; primary declares priority 5                                                     |
| Floor strips              | in front of console              | range markers at the 2.6 m interaction distance and 1.5 m beyond                                      |

The center corridor (x ∈ [−1, 1]) is deliberately kept clear so the
Milestone 0.2 movement browser tests continue to pass in this scene.

## Structure

- `InteractionTestScene.ts` — wiring: player controller, UI views,
  inspection/document controllers, interaction system, dev debug view,
  test bridge; owns disposal order.
- `createInteractionTestArea.ts` — room geometry (reuses the movement
  course's `CourseBuilder` — generic grey-box tooling) + target
  registration.
- `testTargets/` — `switchTargets.ts`, `inspectableTargets.ts`,
  `documentTargets.ts`; each target keeps its state in its own closure.

The previous scenes (`movement-test`, `development`) remain registered in
the SceneManager.
