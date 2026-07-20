# Threat Debugging

## F1 — threat/stealth debug overlay (dev only)

`ThreatDebugOverlay` (facility scene). Toggling F1:

- DOM panel (bottom-left): threat state/phase, encounter id, suspicion,
  detection, exposure, LOS, last-known position, route node, behavior mode,
  hiding state, safe-zone state, active manifestation, fired events,
  vision score, remaining search queue, live stimulus list, recent director
  log lines.
- 3D markers (created on show, disposed on hide, non-pickable, no physics):
  nav nodes + adjacency lines, hiding spot markers (green), safe-zone
  volumes (translucent blue), the threat facing/LOS line (red = line of
  sight held), last-known-position marker (yellow).

F1 is completely inert in production (the overlay is never constructed).
All other debug keys are preserved: \` /F3 overlay, F4 player, F6 ray,
F7 doors, F8 teleport, F9 zones, F10 power, F11 signal, F2 antenna.

## F3 additions

The main debug overlay now appends threat rows (state, phase, encounter,
suspicion/detection, exposure, LOS, last-known, route node, behavior,
hiding, safe zone, manifestation, fired events, encounter-done).

## Test bridge (dev only)

Read-only snapshots: `getThreatSnapshot`, `getThreatRuntimeSnapshot`,
`getManifestationSnapshot`, `getEventDirectorSnapshot`, `getHidingState`,
`listHidingSpots`, `getSafeZoneState`, `getStimulusCount`,
`getThreatDevMessages`. Assists: `enterHidingSpot` (routes through the real
interaction system), `leaveHidingSpot`, `teleportToPosition`. Resets:
`resetThreat` (all threat/event/hiding/manifestation state),
`resetFacility` (now includes the threat reset). The bridge deliberately
has NO way to set threat state, suspicion, detection, event completion or
encounter completion.
