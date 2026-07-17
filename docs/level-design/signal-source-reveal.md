# Signal Source Reveal — Level Design

## What this reveal is (and isn't)

The source-analysis reveal establishes ONE fact: the anomalous
transmission has no valid external bearing, and its return path resolves
to something local to the facility. It does NOT explain what that means,
does NOT name a cause, and does NOT confirm anything supernatural. The
provisional wording (see `source-bearing-analysis.md`) is a deliberate
narrative choice — this is a milestone about instrumentation catching
something it can't fully explain, not a milestone about answers.

## Why "provisional"

Every sentence in the reveal text is hedged: "PRELIMINARY ANALYSIS",
"APPEARS TO RESOLVE", "PROVISIONAL SOURCE CLASSIFICATION", "NOT
CONCLUSIVE". This mirrors the existing decoded-transcript's own tone (M0.7)
and leaves narrative room for M0.9+ to complicate or contradict this
finding without contradicting anything stated as FACT here.

## Deterministic, not randomized — a design constraint, not an implementation detail

Every array's bearing characteristics are hardcoded (see
`docs/architecture/bearing-analysis.md`'s authored-profile table). This
was a hard requirement, not a convenience: a randomized reveal would mean
some playthroughs get a "boring" result and others get a "spooky" one,
undermining the intended pacing beat. Every player reaches the exact same
classification via the exact same evidence, every time — the mystery is
authored, not procedurally generated.

## Local-loop classification vs. "explaining" the mystery

`SourceAnalysisResult.finalCategory` resolves to `'Local'` only when BOTH
`contradictionDetected` (no array validated as external) AND
`localLoopConfirmed` (the diagnostic loop's near-zero path delay) are
true — both conditions are load-bearing for the classification, so the
reveal genuinely follows from the evidence the player collected rather
than being a foregone scripted event dressed up as a deduction.
