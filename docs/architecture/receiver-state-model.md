# Receiver State Model

`src/game/receiver/` wraps the pure `src/game/signal/` math into one piece
of world hardware: power/boot, tuning controls, the scripted scan, and the
device-level mode a player actually experiences. Babylon/DOM-free, same
discipline as `GeneratorController`.

## ReceiverMode

```
Offline    – unpowered.
Booting    – power just applied; a scoped boot timer is running (~1.5s).
Idle       – booted, powered, panel not yet opened this power cycle.
Tuning     – panel open (or was opened this power cycle), no lock yet.
Scanning   – the scripted scan sweep is running (a sub-mode of Tuning).
Locked     – lock acquired; decode not yet started.
Decoding   – lock held, decode InProgress/Paused.
Decoded    – decode completed. Terminal except via powerOff()/reset().
SignalLost – transient: lock broke while still powered (a tuning drift,
             not a power event). Resolves back to Tuning next tick.
Fault      – dev-only fault injection (`simulateFault()`), never reached
             through normal play — mirrors GeneratorController's
             `simulateBatteryDepletion()` precedent.
```

`ReceiverMode.ts`'s `TRANSITIONS` table (mirrors `GeneratorState.ts`'s
shape) rejects illegal jumps: `Offline` can't reach `Tuning` without
passing through `Booting`→`Idle`; `Decoding` requires a prior `Locked`;
`Decoded` doesn't regress to any earlier state. Power loss **always**
routes to `Offline` from every state (see `powerOff()`'s doc comment) —
`SignalLost` is reserved specifically for a quality-driven loss while still
powered, not a power event.

### The one-tick Locked→Decoding gap

`DecodeController` starts accumulating the instant it observes `Locked`
with full hold quality — which, without care, would happen on the exact
same `update()` tick lock is first acquired, collapsing `Locked` and
`Decoding` into the same instant and making `Locked` never externally
observable (the UI explicitly lists them as distinct statuses). To avoid
this, `ReceiverController.update()` skips ticking `DecodeController` on the
precise tick a signal's lock transitions into `Locked`, reconciling
`receiverMode` to `'Locked'` first; decode only begins ticking (and the
mode only advances to `'Decoding'`) starting the _next_ tick. This mirrors
`GeneratorController`'s `Cranking`→`RunningUnstable` precedent, where an
intermediate state is real and event-observable even if it resolves within
the same broader operation.

## ReceiverController

Owns `ReceiverControls` (mutable, from the signal domain) plus one
`SignalLockController`+`DecodeController` pair per registered signal,
keyed by channel. Each `update(dt)` tick:

1. Advances the boot timer, if `Booting`.
2. Advances the scan sweep, if `Scanning` (see below).
3. Evaluates whichever signal is on the currently-tuned channel (if any)
   and ticks _its_ lock/decode controllers with the real quality; every
   _other_ registered signal's controllers are ticked with quality 0 (so
   tuning away from a signal you were locked on lets that lock decay
   naturally, exactly as if you'd simply drifted off it).
4. Reconciles `receiverMode` from the tuned entry's lock/decode state.

Ticked from a single `onBeforeRenderObservable` hook installed by
`ReceiverInteractionTarget` — mirrors `GeneratorInteractionTargets`'
`statusPanelTarget` hook exactly; disposing the interaction target removes
the observer, so the timer is fully scoped.

### Power

`powerOn()`/`powerOff()` are called **only** by
`facilityReceiverBindings.ts`'s `PoweredStateBinding` subscription on the
control-room circuit — `ReceiverController` never polls `PowerNetwork`
itself (per the milestone's non-negotiable constraint #6). `powerOff()`
resets every signal's _live_ lock/decode progress, but not
`decodedSignalIds` — see the decoded-state fast path below.

### Panel open/close

`open()` fails while `Offline`/`Booting`/`Fault`. Opening while `Idle`
advances to `Tuning` and checks the decoded-state fast path (below);
opening while already `Tuning`/`Locked`/`Decoding`/`Decoded`/`SignalLost`
just flips `isPanelOpen` without touching `receiverMode` — closing and
reopening never regresses progress. `close()` only flips `isPanelOpen`;
domain ticking continues in the background regardless (see below).

### Decoded-state fast path

If the currently-tuned channel's signal is already in `decodedSignalIds`
when `open()` transitions `Idle`→`Tuning` (i.e. it was decoded earlier
this power cycle, then the receiver was power-cycled), both sub-controllers
are driven directly to their completed state in a small bounded loop
(iteration count capped by `lockAcquisitionSeconds`/`decodeSeconds` ÷
`MAX_RECEIVER_DT_SECONDS`, never unbounded) rather than requiring the
player to re-tune and wait out lock+decode again. This models a receiver
that remembers its last-decoded transmission in a buffer — realistic, and
much better UX than forcing a ~7-second replay to re-read a transcript.

### Ticking continues with the panel closed

Domain ticking (lock hold, decode accumulation) is gated only by
`receiverMode` (not `Idle`), not by `isPanelOpen`. Once past `Tuning`, a
locked/decoding receiver keeps progressing in the background even with the
panel closed — the tuning controls don't change on their own, so this is
purely "real elapsed time keeps counting," letting a player close the
panel mid-decode, explore, and come back to find it finished.

## Scan behavior

`ReceiverController`'s scan sweep is a deterministic scripted pattern —
**no `Math.random()`** — driven entirely by accumulated `scanElapsed`
time: it cycles through every channel in order, sweeping frequency
linearly from min to max within each channel's slice of the total sweep
duration, and pauses for `scanPauseSeconds` (emitting
`ChannelActivityDetected`) whenever it lands on the activity channel near
the real signal's target frequency. It only ever touches
`channel`/`frequencyMHz` — gain/filter/phase are untouched, so scanning
alone can never solve the puzzle. `startScan()` requires `receiverMode ===
'Tuning'`; any manual control adjustment (`setChannel`/`adjustGain`/etc.)
cancels an active scan immediately.

## ReceiverInteractionTarget

The one Babylon-touching adapter in this domain (mirrors
`GeneratorInteractionTargets.ts`'s precedent): builds the `'receiver'`-kind
`InteractionTarget` for the console mesh and owns the update hook described
above. World geometry lives in
`src/scenes/facility-greybox/signal/buildReceiverConsole.ts`.
