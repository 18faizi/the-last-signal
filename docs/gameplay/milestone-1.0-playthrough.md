# Milestone 1.0 — Complete Greybox Playthrough

## Overview

Milestone 1.0 connects all previous vertical slice systems (Milestones 0.1 through 0.9) into one seamless, start-to-finish 10-chapter playable mystery game. The player traverses Station Echo, restores power, intercepts and decodes an anomalous transmission, aligns the microwave receiver array, discovers that the signal originates from within the station itself, survives a close encounter with the entity manifested by the broadcast, and makes a final decision at the central command console.

---

## Chapter Breakdown & Flow

| Chapter Index | Chapter Name | Primary Objective | Key Progression Gate | Checkpoint |
| :--- | :--- | :--- | :--- | :--- |
| **01** | **Arrival** | Reach perimeter gate & enter facility | Open perimeter gate, enter security gatehouse, read station log (`doc-security-log`) | `fg-cp-spawn`, `fg-cp-gate`, `fg-cp-courtyard` |
| **02** | **Power Restoration** | Restore emergency generator power | Navigate service tunnel, prime fuel pump, clear air intake, engage starter crank | `fg-cp-tunnel-entrance`, `fg-cp-generator-room` |
| **03** | **Primary Routing** | Route main breaker power to substation | Engage Generator Main Breaker in breaker closet | `fg-cp-distribution-panel` |
| **04** | **Secondary Routing** | Power Receiver Room & Control Lobby | Rebalance distribution bus at 4-breaker panel (Substation, Receiver, Antenna, Bunkhouse) | `fg-cp-distribution-panel` |
| **05** | **Signal Interception** | Boot receiver console & tune frequency | Access receiver console, sweep band to 1420.405 MHz, tune azimuth to 042.8° | `fg-cp-receiver` |
| **06** | **Signal Decoding** | Lock carrier signal & demodulate packet | Engage frequency lock, maintain signal stability > 85%, complete demodulation | `fg-cp-receiver` |
| **07** | **Antenna Realignment** | Align rooftop dish & route waveguides | Access rooftop gantry, calibrate azimuth/elevation servos, rotate waveguide switch | `fg-cp-rooftop` |
| **08** | **Source Analysis** | Perform triangulation & local loopback test | Return to receiver terminal, run source bearing analysis, discover local loop | `fg-cp-receiver` |
| **09** | **Threat Encounter** | Survive entity manifestation & reach safety | Hide in locker or break line-of-sight during heightened suspicion, reach safe zone | `fg-cp-encounter-start`, `fg-cp-supervisor` |
| **10** | **Final Decision & Resolution** | Access command console & decide transmission fate | Interact with command terminal (`fg-command-terminal`), select ending protocol, confirm choice | `fg-cp-command-terminal` |

---

## In-Game Player Guidance & Objectives

### Dynamic Objective HUD
- **HUD Location**: Top-left corner of the viewport.
- **Auto-Reveal**: Automatically fades in for 5 seconds when an objective is assigned, updated, or completed.
- **Recall Key**: Pressing `Q` toggles objective HUD visibility at any time.
- **Overlay Suppression**: Automatically suppressed during inspection overlays, reading documents, receiver mode, antenna tuning, and final decision terminals.

### Tiered Contextual Hint System
If a player spends time without completing an active step, the hint system gradually escalates guidance without breaking immersion:
1. **Tier 0 (None)**: Normal unassisted gameplay.
2. **Tier 1 (Subtle)**: Thematic environmental hints pointing toward the problem space (e.g., *"The perimeter gate requires a manual release lever."*).
3. **Tier 2 (Directional)**: Spatial orientation hints (e.g., *"The generator is located in the basement service tunnel beneath the courtyard."*).
4. **Tier 3 (Specific)**: Actionable operational guidance (e.g., *"Prime the fuel valve to 100% before activating the starter ignition."*).
- Any progress resets the hint tier and timer to preserve player agency.

---

## Decision Terminal & Ending Protocols

Located in the Control Room overlooking the facility courtyard (`(-2, 1.1, 23.5)`), the Central Command Terminal presents three mutually exclusive protocols:

1. **Protocol Omega — SILENCE** (`SILENCE`)
   - *Requirement*: Always accessible.
   - *Action*: Emergency carrier disconnect and memory buffer wipe.
   - *Outcome*: The loop is severed, the entity dissipates, and Station Echo goes silent forever.

2. **Protocol Sigma — RESPONSE** (`RESPONSE`)
   - *Requirement*: Demodulated anomalous transmission (`FirstTransmissionDecoded`) + aligned rooftop antenna (`AntennaAligned`).
   - *Action*: Reverse-phase telemetry burst transmitted into the dark.
   - *Outcome*: An acknowledgment pulse is fired outward; an unknown receiver acknowledges station coordinates.

3. **Protocol Delta — ARCHIVE** (`ARCHIVE`)
   - *Requirement*: Local loop source confirmed (`LocalLoopResultRevealed`) + historical anomaly file inspected (`ArchiveEvidenceDiscovered`).
   - *Action*: High-density magnetic tape extraction of raw carrier signal before physical disconnect.
   - *Outcome*: The evidence is safely extracted onto physical media for future investigation.

---

## Post-Completion Debriefing & Exploration

Following the cinematic conclusion:
- **Audit Debriefing**: Summarizes playtime, narrative facts unlocked, readable documents discovered, and checkpoints reached.
- **Restart Mission**: Cleanly resets all state, systems, inventory, and doors to Chapter 1 Arrival at the spawn point.
- **Continue Exploring**: Re-enables player traversal in the solved facility with objectives cleared for unrestricted lore investigation.
