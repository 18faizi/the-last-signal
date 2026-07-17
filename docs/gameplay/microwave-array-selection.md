# Microwave Array Selection

The rooftop deck carries three distinct microwave arrays. Select between
them with `W`/`S` to the ARRAY row, then `A`/`D` to cycle.

## North Dish

A medium-gain dish with a WIDE capture angle — the most forgiving array
to align, and a reasonable first array to practice the controls on. Its
bearing readings are consistently weak, though: even perfectly aligned,
it never produces a confident enough reading to count as a clean external
source.

## East Relay Dish

Higher gain, but a much NARROWER tolerance — this one takes real
precision to align. It's the array required to actually carry the
transmission through to the receiver, and its waveguide feed needs a
routing fix before it will pass anything at all (see
`waveguide-routing.md`). When aligned, its bearing reading is strong —
almost too strong — but noticeably unstable from moment to moment,
consistent with a reflected/relayed signal path rather than a clean
line-of-sight source.

## Tower Diagnostic Loop

Short-range, low gain, wide/forgiving tolerances — easy to dismiss as
irrelevant at first. It isn't meant to receive anything from far away; its
role is diagnostic. Its bearing reading has an almost nonexistent
propagation delay, which only makes physical sense for a source that
isn't actually distant at all.

## Why sample all three

Source analysis (see `source-bearing-analysis.md`) needs a reading from
each of the three arrays before it can compare them. Each array's
characteristics are deliberately different — the comparison is the point.

Target values (spec-exact, East Relay Dish): azimuth 42° ±8°, elevation
18° ±6°, polarization -35° ±12°. North Dish and Tower Diagnostic Loop have
comparatively easier, wider-tolerance solutions — use the alignment meter
and limiting-factor readout rather than memorizing exact numbers.
