# Source Bearing Analysis

Once the transmission is decoded, the rooftop circuit is powered, and the
East Relay Dish's waveguide route is corrected, the antenna panel's
source-analysis section becomes active.

## Collecting samples

With an array selected and reasonably aligned, press `Enter` to record a
sample: your current alignment, the array's bearing estimate, and a
confidence reading. A sample only "counts" once alignment quality clears
a meaningful threshold and the rooftop circuit is powered — a half-aligned
reading is rejected rather than silently recorded as bad data. Sampling
the same array twice doesn't create a duplicate entry; it just keeps the
first (best-available) reading for that array this analysis cycle.

You need one sample each from North Dish, East Relay Dish, and the Tower
Diagnostic Loop.

## Running the comparison

Once all three samples are collected, the SAME `Enter` key now runs the
comparison instead of collecting another sample. The source-analysis panel
shows each sample's category and confidence, then the final classification.

## The reveal (provisional)

The comparison is deterministic — it isn't a random roll. None of the
three arrays ever produces a bearing confident and stable enough to count
as a genuine external source; the Tower Diagnostic Loop's reading, with
its near-zero propagation delay, is what confirms the signal isn't coming
from outside the facility at all.

The panel's final text is deliberately hedged and incomplete:

> PRELIMINARY ANALYSIS — NO VALID EXTERNAL BEARING FOUND. RETURN PATH
> APPEARS TO RESOLVE TO LOCAL FACILITY INFRASTRUCTURE. PROVISIONAL SOURCE
> CLASSIFICATION: LOCAL LOOP. FURTHER INVESTIGATION REQUIRED — THIS
> ASSESSMENT IS NOT CONCLUSIVE.

This establishes the local-loop/anomalous classification without
explaining WHY, and without confirming anything supernatural — that's
intentionally left for later milestones.

## Persistence

Once resolved, the classification is permanent for the session — closing
and reopening the panel, or cycling rooftop power, never re-triggers the
comparison or duplicates a sample. The underlying decoded transmission
(from the receiver puzzle) also stays decoded regardless of anything you
do here — source analysis can never reset it.
