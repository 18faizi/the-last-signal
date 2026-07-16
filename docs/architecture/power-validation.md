# Power Validation

`src/game/power/PowerValidation.ts` mirrors `FacilityValidator.ts`'s
contract exactly: `validatePowerNetworkData(input): string[]`, a pure
function over plain definition arrays (no live `PowerNetwork` instance
needed), returning human-readable problem strings — an empty array means the
data is valid.

## Checks

1. **Duplicate ids** within sources, circuits, and loads.
2. **Non-positive `maxCapacity`** on a source.
3. **Non-positive `capacityCost`** on a circuit.
4. **A circuit with zero `eligibleSourceIds`** — can never be energized.
5. **A circuit's `eligibleSourceIds` referencing an unknown source id.**
6. **A load referencing an unknown circuit id.**
7. **An `emergencyEligible` circuit costing more than the battery's
   `maxCapacity`** — it's honestly marked eligible but can never actually be
   powered from the battery, which is almost certainly a data-authoring
   mistake.
8. **A circuit costing more than any of its eligible sources could ever
   supply** — flagged as "unwinnable": no sequence of allocation choices
   could ever energize it, distinct from the (intentional) case where it
   merely doesn't fit _alongside_ other circuits.

## When it runs

`FacilityGreyboxScene.ts` calls it once at scene creation, development mode
only, immediately after registering every source/circuit/load definition:

```ts
if (context.environment.isDevelopment) {
  const problems = validatePowerNetworkData({ sources, circuits, loads });
  if (problems.length > 0) {
    throw new Error(`[PowerValidator] ${problems.join('; ')}`);
  }
}
```

Unlike `FacilityValidator`'s door/zone checks (which only `console.warn`,
because a bad door reference is recoverable at runtime — the door just
stays inaccessible), a power-data integrity failure throws. A miswired
circuit/source graph would silently make circuits permanently unwinnable in
a way that's easy to miss during manual testing and hard to diagnose later,
so it's treated as a genuine build-breaking error in development rather
than a soft warning — while still not being a _production_ fatal-screen
path, since this validator never runs outside development builds at all.
