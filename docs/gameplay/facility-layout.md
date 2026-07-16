# Facility Layout — Milestone 0.5 Greybox

The greybox facility is a multi-zone complex that represents the abandoned
telecommunications relay station the player explores. All geometry is white-box
(StandardMaterial with flat colours); no art assets are used.

## Coordinate system

- `+X` = east, `-X` = west
- `+Z` = south, `-Z` = north
- `+Y` = up
- Player spawn: `(-58, 0.1, 0)` facing east (yaw = 0)
- Ground plane: `Y = 0`

## Zones and AABBs

| Zone ID                      | Label               | Key zone | AABB (minX…maxX, minZ…maxZ) |
| ---------------------------- | ------------------- | -------- | --------------------------- |
| `fg-zone-mountain-approach`  | Mountain Approach   | yes      | -60 … -30, -20 … 20         |
| `fg-zone-compound-exterior`  | Compound Exterior   | yes      | -30 … 0, -30 … 30           |
| `fg-zone-maintenance-tunnel` | Maintenance Tunnel  | no       | -10 … 0, -5 … 5             |
| `fg-zone-control-building`   | Control Building    | yes      | 0 … 30, -20 … 20            |
| `fg-zone-generator-room`     | Generator Room      | yes      | 10 … 25, 5 … 20             |
| `fg-zone-relay-room`         | Relay Room          | yes      | 10 … 25, -20 … -5           |
| `fg-zone-rooftop`            | Rooftop             | yes      | 0 … 30, -20 … 20 (Y≥8)      |
| `fg-zone-supervisor-office`  | Supervisor's Office | yes      | 18 … 28, -15 … -5           |
| `fg-zone-staff-quarters`     | Staff Quarters      | no       | 0 … 15, -20 … -5            |

Zone membership is determined by AABB point-in-box tests polled every frame on
`onBeforeRenderObservable`. See `docs/architecture/zone-trigger-system.md`.

## Doors and locks

| Door ID                   | Lock type | Required item(s)                                              |
| ------------------------- | --------- | ------------------------------------------------------------- |
| `fg-door-compound-gate`   | item      | `fg-compound-gate-key` (retained)                             |
| `fg-door-tunnel-shortcut` | any-of    | `fg-compound-gate-key` OR `fg-maintenance-card`               |
| `fg-door-generator`       | item      | `fg-generator-key` (retained)                                 |
| `fg-door-relay-room`      | all-of    | `fg-antenna-access-card` AND `fg-override-seal` (consumed ×1) |
| `fg-door-supervisor`      | item      | `fg-supervisor-key` (retained)                                |
| `fg-door-rooftop`         | item      | `fg-antenna-access-card` (retained)                           |

## Pickups

| Pickup ID                       | Item ID                  | Grants zone access      |
| ------------------------------- | ------------------------ | ----------------------- |
| `fg-pickup-compound-gate-key`   | `fg-compound-gate-key`   | compound exterior       |
| `fg-pickup-maintenance-card`    | `fg-maintenance-card`    | maintenance tunnel      |
| `fg-pickup-generator-key`       | `fg-generator-key`       | generator room          |
| `fg-pickup-antenna-access-card` | `fg-antenna-access-card` | relay room + rooftop    |
| `fg-pickup-override-seal-1`     | `fg-override-seal`       | relay room (consumable) |
| `fg-pickup-override-seal-2`     | `fg-override-seal`       | relay room (consumable) |
| `fg-pickup-supervisor-key`      | `fg-supervisor-key`      | supervisor office       |

## Teleport positions (dev only, F8)

| Teleport ID        | Label             | Position (X, Y, Z) |
| ------------------ | ----------------- | ------------------ |
| `fg-tp-spawn`      | Spawn             | -58, 0.1, 0        |
| `fg-tp-courtyard`  | Courtyard         | 10, 0.1, 0         |
| `fg-tp-generator`  | Generator Room    | 17, 0.1, 12        |
| `fg-tp-relay`      | Relay Room        | 17, 0.1, -12       |
| `fg-tp-rooftop`    | Rooftop           | 15, 8.3, 0         |
| `fg-tp-supervisor` | Supervisor Office | 23, 0.1, -10       |

## Checkpoints

| Checkpoint ID                    | Label                    | Spawn position |
| -------------------------------- | ------------------------ | -------------- |
| `fg-cp-spawn`                    | Spawn                    | -58, 0.1, 0    |
| `fg-cp-compound-entered`         | Compound Entered         | -20, 0.1, 0    |
| `fg-cp-control-building-reached` | Control Building Reached | 5, 0.1, 0      |
| `fg-cp-rooftop`                  | Rooftop                  | 15, 8.3, 0     |
