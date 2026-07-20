# Threat State Model

`src/game/threat/ThreatState.ts` defines the 12 threat actor states and the
single transition table every change must pass through
(`tryTransitionThreatState`).

| from          | allowed to                                                   |
| ------------- | ------------------------------------------------------------ |
| Dormant       | Manifesting, Unaware, Fault                                  |
| Manifesting   | Observing, Inactive, Fault                                   |
| Observing     | Unaware, Investigating, Withdrawing, Fault                   |
| Unaware       | Suspicious, Withdrawing, Fault                               |
| Suspicious    | Unaware, Investigating, Pursuing, Withdrawing, Fault         |
| Investigating | Unaware, Suspicious, Searching, Pursuing, Withdrawing, Fault |
| Searching     | Investigating, Pursuing, LostTarget, Withdrawing, Fault      |
| Pursuing      | LostTarget, Withdrawing, Fault                               |
| LostTarget    | Searching, Withdrawing, Fault                                |
| Withdrawing   | Dormant, Inactive, Fault                                     |
| Inactive      | —                                                            |
| Fault         | —                                                            |

## Authored guarantees

- **Dormant can never jump to Pursuing** (or any escalated state) —
  activation always passes through Manifesting or Unaware.
- **Manifesting resolves only to Observing or Inactive.**
- **Pursuing requires confirmed detection.** The table encodes reachability
  (only Suspicious/Investigating/Searching can enter it); the controller
  additionally requires the suspicion model's one-shot full-detection EDGE —
  the level flag is never consulted, so LostTarget → Searching can never
  chain straight back into a pursuit.
- **LostTarget** is reachable only from Pursuing/Searching.
- **Withdrawing ends at Dormant or Inactive**, nothing else.
- **Fault never silently resumes** — zero successors; only the dev full
  reset (an explicit, sanctioned table bypass) clears it.

`isThreatActive()` classifies Dormant/Inactive/Fault as zero-cost states
(the scene detaches the per-frame observer); `isThreatPerceiving()` excludes
Manifesting/Withdrawing from perception (staged presences never perceive).

Encounter retry (`resetForEncounterRetry`) walks LEGAL transitions only:
current → Withdrawing → Dormant → Unaware.
