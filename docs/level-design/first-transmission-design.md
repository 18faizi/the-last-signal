# First Transmission Design

`first_anomalous_transmission` (channel 3,
`src/scenes/facility-greybox/signal/facilitySignalDefinitions.ts`) is the
milestone's one required signal, and its transcript
(`doc-transmission-first-anomalous`,
`src/scenes/facility-greybox/facilityDocumentDefinitions.ts`) is the
milestone's one piece of new narrative payoff.

## Intent

The transcript is deliberately short (roughly 100 words), explicitly
labeled provisional ("PROVISIONAL DECODE — UNVERIFIED"), and raises two
unresolved narrative threads without explaining either:

- **An impossible timestamp** — the embedded receive time precedes the
  actual reception, which the in-fiction receiving operator flags as
  "not possible for a real transmission," suggesting either equipment
  fault or something the game isn't ready to explain yet.
- **A warning not to restore the rooftop array** — directly relevant to
  the rooftop antenna the player has already walked past in M0.5, without
  saying why, seeding a reason a future milestone might make that choice
  meaningful rather than cosmetic.

This mirrors the existing `doc-archive-report` document
(`facilityDocumentDefinitions.ts`) — anomalous-signal flavor text already
present in M0.5/M0.6 — so the payoff of actually decoding a transmission
pays off a thread the player may already have read about, rather than
introducing a wholly disconnected idea.

## Why not more transmissions

Per the milestone's non-negotiable constraints, additional story
transmissions are explicitly out of scope for M0.7 — this is the
mechanical proof-of-concept for the tuning puzzle and one narrative beat,
not the full communications-archive content pass.

## Tuning target rationale

See `docs/level-design/tuning-difficulty-balance.md` for why the specific
frequency/gain/filter/phase values and tolerances were chosen.
