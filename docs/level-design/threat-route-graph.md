# Threat Route Graph

Eight authored nodes (`FACILITY_THREAT_GRAPH`), all inside the allowed
zones (relay room, stairwell, control room):

| node                       | position      | zone         | priority |
| -------------------------- | ------------- | ------------ | -------- |
| fg-tnode-relay-east (home) | 4, 3.1, 23    | relay room   | 1        |
| fg-tnode-relay-mid         | 0, 3.1, 23    | relay room   | 2        |
| fg-tnode-stair-top         | -7, 3.1, 25.6 | stairwell    | 3        |
| fg-tnode-stair-bottom      | -7, 0.1, 24   | control room | 4        |
| fg-tnode-ctrl-south        | 0, 0.1, 16.6  | control room | 5        |
| fg-tnode-ctrl-west         | -7, 0.1, 20   | control room | 6        |
| fg-tnode-ctrl-mid          | -2, 0.1, 20   | control room | 7        |
| fg-tnode-ctrl-desk         | -4, 0.1, 17.5 | control room | 8        |

Adjacency is a simple chain relay-east ↔ relay-mid ↔ stair-top ↔
stair-bottom ↔ ctrl-west ↔ ctrl-mid, with ctrl-mid also linking ctrl-desk
and ctrl-south. `fg-tnode-ctrl-south` is the safe-zone boundary node — the
lobby beyond it is a safe zone and deliberately contains no nodes (verified
by a unit test).

- Route selection: BFS shortest hop path in authored adjacency order.
- Search ordering: priority desc → distance to last-known asc → id asc;
  fully deterministic and reproducible (unit-verified). Priorities favor
  the control-room interior (desk/mid/west) before the stairwell and relay
  level, so a sweep reads as "checks the room first, then the stairs".
- Door gating: nodes may declare `requiresDoorId`; closed doors prune both
  routing and search (no authored node uses it yet — the mechanism is
  tested and ready).
- Movement: kinematic, frame-rate independent, faces the travel direction,
  snaps exactly onto waypoints; pursuit is direct-line within the allowed
  zones with a confinement revert at the boundary.
