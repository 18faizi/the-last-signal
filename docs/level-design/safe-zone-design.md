# Safe Zone Design

Typed safe zones (`SafeZoneDefinition`/`SafeZoneRegistry`) are AABB volumes
the threat categorically refuses to enter (`threatEnterable: false` is a
validated invariant in M0.9).

| id                         | volume             | role                                                                                                               |
| -------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| fg-safezone-control-lobby  | lobby, z ∈ [11,16] | the authored encounter endpoint; resolves `fg-encounter-first-contact`; linked to checkpoint `fg-cp-control-lobby` |
| fg-safezone-security-booth | booth by the gate  | early-game refuge; resolves nothing                                                                                |

Reaching a safe zone while pursued emits the threat's `SafeZoneRefusal`
event → the runtime phase advances to `SafeZoneReached` → director Event D
completes the encounter and withdraws the threat for good. Detection decays
inside (`detectionDecays: true`), and a capture is structurally impossible
inside a safe zone (`isPlayerCaptured` returns false).

Design rules observed:

- Safe zones never overlap the threat nav graph (unit-tested invariant).
- The lobby boundary sits one doorway beyond the last graph node, so the
  pursuit visibly halts at the threshold rather than evaporating mid-room.
- Safe zones are generous enough to enter at sprint speed under pursuit
  (the doorway is 2 m wide and the zone starts at its plane).
