# Bearing / Source-Analysis

`src/game/source-analysis/` is the pure-TypeScript layer for the bearing
estimate + cross-array comparison that produces the milestone's central
reveal: the anomalous transmission has no valid external bearing.

## Files

- **`SignalBearing.ts`** — the bearing result shape: estimated azimuth/
  elevation, confidence, stability, `externalSourceValid`,
  `localCouplingLikelihood`, modeled `pathDelayMs`, and a
  `SourceCandidateCategory` (`External | Reflected | Local | Indeterminate
| Impossible`).
- **`BearingEvaluator.ts`** — `evaluateBearing()`, a PURE function of
  (array role, current alignment quality, mechanical azimuth/elevation).
  See "Authored profiles" below.
- **`SourceCandidate.ts`** — one collected sample: array id, az/el/pol,
  alignment quality, receiver quality, waveguide state, powered flag, the
  computed bearing, confidence, and a 0-based sequence index.
- **`SourceAnalysisState.ts`** — `Unavailable | Collecting |
InsufficientData | Comparing | ContradictionDetected | LocalLoopCandidate
| Resolved`, with an explicit transition table (`InsufficientData` is
  transient, mirroring `SignalLockController`'s `Lost` state pattern).
- **`SourceAnalysisController.ts`** — collects samples (idempotent per
  array per cycle), requires all 3 required arrays sampled before
  `runComparison()` proceeds, runs the deterministic
  comparison → contradiction → local-loop pipeline exactly once.
- **`SourceAnalysisResult.ts`** — `evaluateSourceAnalysisResult()`, the
  pure comparison function, plus the structured result shape
  (`contradictionDetected`, `localLoopConfirmed`, `finalCategory`,
  machine-readable `explanationTags`).
- **`SourceAnalysisEvent.ts`** — typed event union + bus.
- **`AnalysisQualityEvaluator.ts`** — the Phase-4 receiver-composition
  evaluator (see "Two quality concepts" below).

## Authored profiles (deterministic, NOT randomized)

`BearingEvaluator.ts` hardcodes one profile per `AntennaArrayRole`:

| Role                                | baseConfidence | baseStability | category    | localCoupling | pathDelayMs |
| ----------------------------------- | -------------- | ------------- | ----------- | ------------- | ----------- |
| `ExternalCandidate` (North Dish)    | 0.45           | 0.6           | `External`  | 0.15          | 38          |
| `RelayCandidate` (East Relay)       | 0.8            | 0.25          | `Reflected` | 0.35          | 22          |
| `DiagnosticLoop` (Tower Diagnostic) | 0.9            | 0.9           | `Local`     | 0.95          | 0.4         |

`externalSourceValid` additionally requires `category === 'External'` AND
both confidence and stability at/above 0.6 — North Dish's confidence
(0.45 × alignment quality) can NEVER clear that floor even at perfect
alignment, and East Relay's category is `Reflected`, not `External`, so it
never qualifies either. This is the deterministic basis for the reveal: no
array EVER produces a valid external bearing, regardless of how well it's
aligned — it is an authored fact about the three arrays' characteristics,
not a probability that happens to come up empty.

The diagnostic loop's near-zero `pathDelayMs` (0.4ms) is the tell:
`evaluateSourceAnalysisResult()` treats `pathDelayMs < 2` combined with
`localCouplingLikelihood >= 0.5` as confirming local coupling.

## Two quality concepts — never conflated

1. **Receiver decode quality** (`ReceiverMetrics.overallQuality`, M0.7,
   UNCHANGED) — decodes `first_anomalous_transmission`. Permanent once
   achieved (`ReceiverRuntimeState`); nothing in M0.8 resets it.
2. **Source-analysis quality** (`AnalysisQualityEvaluator.ts`,
   `evaluateAnalysisQualityCeiling()`, M0.8 new) — gates whether a sample
   collected right now is trustworthy:

   ```
   analysisQualityCeiling = receiverTuningQuality × antennaAlignmentQuality
                              × waveguideContinuity × powerAvailability
                              (hard 0 if transmissionDecoded is false)
   ```

   `antennaAlignmentQuality` here is `AntennaMetrics.alignmentQuality`
   (the PURE axis-only term), not `overallQuality` — using `overallQuality`
   would double-gate power/waveguide, since this function already applies
   its own live `waveguideQuality`/`rooftopPowered` inputs. See
   `antenna-state-model.md`'s "AntennaEvaluator combination formula".

   The player never needs to repeat the 5-second decode process when
   adjusting the rooftop array — `receiverTuningQuality` is
   `ReceiverMetrics.overallQuality` reused AS-IS.

## Sample collection guardrails

`SourceAnalysisController.collectSample()` rejects a sample below
`MIN_MEANINGFUL_ALIGNMENT_QUALITY` (0.4) or while unpowered, and is
idempotent per array — a second call for an already-sampled array returns
the EXISTING sample without creating a duplicate or re-firing
`SampleCollected`. `runComparison()` requires ALL 3 required arrays
sampled; fewer transitions to the transient `InsufficientData` state and
returns `null`.
