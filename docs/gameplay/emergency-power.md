# Emergency Power

The facility carries a small emergency battery (2 capacity units,
`fg-power-src-battery`) independent of the generator's own starter battery
(a different concept — see `docs/gameplay/generator-startup.md`).

## Before the generator starts

At scene boot, `EmergencyPowerController.initializeEmergencyPower()` brings
the battery online and energizes every `emergencyEligible` circuit from it.
In the current facility plan that's just the **Emergency & Security** circuit
(cost 1) — the only circuit cheap enough to fit in the battery's 2-unit
capacity while leaving margin. Perimeter gate lighting and a security
floodlight are live from the moment the scene loads, before the player has
even found the generator.

## Handoff once the generator comes online

When the player closes the generator's main breaker,
`EmergencyPowerController.onGeneratorMainBreakerClosed()`:

1. Marks the generator source `available` in `PowerNetwork`.
2. Calls `PowerNetwork.transferCircuits(battery, generator)`, which re-homes
   every circuit currently drawn from the battery onto the generator
   (best-effort — a circuit that doesn't fit stays on the battery rather
   than being dropped).

This frees the battery's capacity and demonstrates the priority hierarchy:
the generator (priority 10) supersedes the battery (priority 1) once it's
available, but the transfer is explicit domain logic, not a hidden
side-effect buried in `PowerNetwork` itself — `PowerNetwork` stays a generic
multi-source allocator with no built-in notion of "emergency" or
"generator".

## Fallback

If the generator later goes offline (main breaker opens, fault, or manual
stop), `EmergencyPowerController.onGeneratorOffline()` marks the generator
source offline (cascading de-energizes everything sourced from it,
including the transferred emergency circuit) and re-attempts battery power
for any emergency-eligible circuit that just went dark — so perimeter/gate
lighting comes back even if the generator dies.
