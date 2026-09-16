# Architecture: Game Flow, Checkpoint Snapshots & Endings

## Architectural Overview

Milestone 1.0 establishes the high-level progression, persistence, and narrative resolution layer of _The Last Signal_. It orchestrates domain systems (Power, Receiver, Antenna, Threat, Documents, Inventory) into a strictly validated state machine.

```
                  ┌──────────────────────┐
                  │    GameFlowState     │
                  │  (Chapter & Timer)   │
                  └──────────┬───────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Objective   │      │     Hint     │      │  Narrative   │
│  Controller  │      │  Controller  │      │ FactRegistry │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             ▼
              ┌──────────────────────────────┐
              │  CheckpointSnapshotManager   │
              │ (Version 1 Serializable DTO) │
              └──────────────┬───────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │ ProgressionRecoveryValidator │
              │   (Soft-Lock Sanitization)   │
              └──────────────────────────────┘
```

---

## 1. Game Flow State Machine

`GameFlowState` manages high-level chapter transitions defined in `GameChapter.ts`:

- **10 Sequential Story Chapters**:
  - `Arrival`
  - `PowerRestoration`
  - `PrimaryRouting`
  - `SecondaryRouting`
  - `SignalInterception`
  - `SignalDecoding`
  - `AntennaRealignment`
  - `SourceAnalysis`
  - `ThreatEncounter`
  - `ThreatAftermath`
  - `FinalDecision`
  - `Ending`
  - `PostCompletion`
- **Directed Graph Verification**: Validated at startup by `CriticalPathGraphValidator`. A directed acyclic progression from `Arrival` to `PostCompletion`, with an allowed loopback edge from `PostCompletion -> Arrival` for mission restarts.
- **Strict Transition Enforcement**: `assertChapterTransition(from, to)` prevents accidental out-of-order phase skips while `forceChapter(to)` permits developer jump debugging and emergency snapshot recovery.

---

## 2. Checkpoint Snapshot Architecture (Version 1)

`RuntimeCheckpointSnapshot` is a versioned, serializable Data Transfer Object containing zero Babylon.js meshes or DOM node references.

### Schema Fields

- `version`: Fixed integer `1`.
- `checkpointId`: Active checkpoint identifier (one of 13 station checkpoints).
- `timestamp`: Epoch millisecond timestamp of capture.
- `chapter`: Current `GameChapter`.
- `player`: Transform snapshot (`position: [x, y, z]`, `yaw`, `pitch`).
- `flow`: Active and completed objective IDs, chosen ending, completion flags.
- `narrativeFacts`: Array of unlocked narrative fact IDs.
- `inventory`: Array of collected inventory item IDs.
- `doors`: Map of door ID to open/locked state.
- `generator`: Phase, fuel level, air intake, starter engaged, output kW.
- `power`: Active routes, breaker toggles, allocated power units.
- `receiver`: Tuned frequency, azimuth, lock status, demodulation progress.
- `antenna`: Dish azimuth, elevation, waveguide routing index.
- `documents`: Set of read document IDs.

### Soft-Lock Validator (`ProgressionRecoveryValidator`)

When restoring a snapshot, `ProgressionRecoveryValidator` validates invariants to ensure the player cannot load into a corrupted or impossible game state:

1. **Chapter Consistency**: Ensures prerequisites are met for the active chapter (e.g., Chapter `SignalDecoding` requires generator power output > 0).
2. **Key Invariants**: If the player is in an interior zone beyond a locked keycard door, the requisite keycard must either be in inventory or the door must be permanently unlocked.
3. **Breaker Sanity**: Ensures essential breakers are enabled if the active chapter demands power routing.
4. **Correction Strategy**: Mutates the snapshot state to resolve inconsistencies before handing it to system consumers.

---

## 3. Final Decision Controller & Ending Framework

### Prerequisite Resolution

`FinalDecisionController` gates access to the three ending pathways:

- **`SILENCE`**: Always unlocked.
- **`RESPONSE`**: Requires facts `FirstTransmissionDecoded` AND `AntennaAligned`.
- **`ARCHIVE`**: Requires facts `LocalLoopResultRevealed` AND `ArchiveEvidenceDiscovered`.

### Two-Step Confirmation

To prevent accidental choices:

1. First selection highlights the pathway and displays the protocol summary and narrative consequence.
2. Clicking the active selection or pressing the dedicated confirmation button reveals the confirmation prompt: _"CONFIRMATION REQUIRED: Execute [Protocol Code]?"_.
3. Confirming transfers control to `EndingSequenceController`; canceling reverts the terminal to pathway selection.

### In-Engine Ending Cinematic (`EndingCinematicView`)

- **Letterbox Bars**: Cinematic widescreen masking over the 3D viewport.
- **Typewriter Readout**: Atmospheric text telemetry describing systemic shutdowns, broadcast pulses, or tape spooling.
- **Skip Support**: Players or automated tests can press `Escape` / `Space` / call `skipEndingSequence` to advance directly to the debriefing.

### Restart Coordination (`RestartController`)

`RestartController` coordinates total game state reset without full page reloading:

- Resets player position to spawn coordinates `(0, 1, -12)`.
- Resets `GameFlowState` to `Arrival`.
- Clears inventory items and resets door locks.
- Resets generator fuel, air intake, and breaker states.
- Resets receiver tuning dials and antenna dish orientation.
- Clears unlocked narrative facts and resets hints.
- Re-activates initial objective `obj-reach-gate`.
