# Threat Validation

Development builds validate all authored threat data at scene creation and
throw on problems (mirrors Power/Signal/Antenna validators). Production
skips validation entirely.

## `validateThreatDefinition` (ThreatValidation.ts)

- nav graph structure (via `validateThreatNavGraph`): unique ids, known
  links, no self links, no orphans, finite priorities;
- home node exists; allowed zones and safe zones are registered;
- every nav node's zone is inside the allowed set; door-gated nodes
  reference known doors;
- vision ranges (positive distances, FOV in (0,360], falloff within range,
  multipliers ordered sprint ≥ walk ≥ crouch, penalties within [0,1]);
- suspicion thresholds ordered (0 < suspicious < investigate ≤ 1, relax
  below suspicious), all rates positive, post-LOS-break detection decay
  slower than in-LOS decay, detection vision floor in (0,1);
- all movement values positive.

## Other validators

- `HidingSpotRegistry.validate` — concealment in [0,1], fullyHiding implies
  concealment 1, positive interaction distance, look limit in [0,π], zone
  registered.
- `SafeZoneRegistry.validate` — well-formed AABBs, `threatEnterable` must be
  false in M0.9, checkpoint links must exist.
- `validateEventDefinitions` — see `event-director.md`.

Unit coverage: `threatValidation.test.ts`, `hidingController.test.ts`,
`eventDirector.test.ts` exercise both the clean authored data and each
problem class.
