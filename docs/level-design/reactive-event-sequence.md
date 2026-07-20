# Reactive Event Sequence (Events A-D)

Authored in `facilityEncounterDefinitions.ts`; validated (ids, deps,
acyclicity) at scene creation. All conditions/actions are typed objects.

## A — `fg-event-rooftop-aftermath` (one-shot, delay 2 s)

Conditions: antenna reveal complete + threat phase ≥ AntennaAftermathPending

- player in gameplay mode.
  Actions: rooftop warning light `blink`, begin stairwell silhouette
  manifestation, advance phase → FirstManifestation, dev message.

## B — `fg-event-control-disturbance` (one-shot, dep A, delay 1.5 s)

Conditions: inside `fg-zone-control-room` + ≥8 s since A + gameplay mode.
Actions: warning light `cut`, corridor light `off`, corridor-light
disturbance manifestation, close `fg-door-control-entrance` (a real door
operation → a real audible stimulus), phone indicator `blink`, advance
phase → DisturbanceSequence, dev message.

## C — `fg-event-first-investigation` (one-shot, dep B)

Conditions: inside the control room + ≥5 s since B + gameplay mode.
Actions: set encounter checkpoint, begin encounter, enable hiding prompts,
doorway-crossing + phone manifestations, threat activates Unaware at
relay-mid and routes to ctrl-west, dev message. Everything after this is
systemic (real stimuli → real investigation → real search).

## Keeper — `fg-event-threat-reactivate` (repeatable, dep C, delay 3 s)

Conditions: threat state Dormant + player inside the control room. Re-arms
whenever its conditions go false, so a threat that withdrew without a
resolution always comes back — and once Event D's final withdraw ends at
Inactive, the Dormant condition can never hold again.

## D — `fg-event-safe-zone-resolution` (one-shot, dep C, delay 0.5 s)

Condition: threat phase ≥ SafeZoneReached (advanced by the real
SafeZoneRefusal event). Actions: complete the encounter (one-shot),
threat-withdraw FINAL (ends Inactive), corridor light back `on`, dev
message. The bindings then advance ThreatFoundationComplete when the
withdraw completes, showing the completion banner.
