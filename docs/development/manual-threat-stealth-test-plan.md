# Manual Threat & Stealth Test Plan

Prereq: complete M0.6-M0.8 (generator → control room + rooftop circuits →
decode `first_anomalous_transmission` → waveguide fix → three samples →
comparison reveal). Dev build (`pnpm dev`).

## A. Aftermath & disturbance

1. Finish the reveal at the antenna cabinet, close the panel. Within ~2 s
   the rooftop warning fixture blinks. Descend toward the stairwell — a
   silhouette stands briefly at the stairwell top and vanishes when you
   lose sight of it (or after ~6 s). No pursuit, no meter.
2. Enter the control room (≥8 s later): corridor light dies, the entrance
   door closes behind you, the duty phone blinks. A presence crosses the
   far end of the room. F1 confirms events A/B fired once.

## B. Encounter, hiding, avoidance

3. ~5 s later the encounter starts (F3: encounter id set, prompts armed).
   The threat appears upstairs and descends. Sprint a few steps: the meter
   appears (OBSERVED → SUSPICION); the threat comes to investigate.
4. Hide in the maintenance locker (`[E] HIDE`). Verify: camera glides in,
   `HIDDEN — [E] LEAVE HIDING PLACE`, no inventory/Tab/receiver possible,
   movement locked. The threat searches and never detects you. Leave —
   verify your exact position/view returns and no stale movement occurs.
5. Stand motionless in darkness as it passes: suspicion decays, meter
   fades.

## C. Detection, pursuit, failure, resolution

6. Walk in front of it in the lit area until DETECTED: it pursues. Verify
   it never outruns your sprint, loses you after ~3.5 s without line of
   sight, and never enters the lobby.
7. Let it catch you: brief fade, `ENCOUNTER RESET`, respawn at the
   encounter checkpoint. Verify inventory/power/decode/antenna are intact
   and the threat is back upstairs, calm.
8. Get detected again and sprint into the lobby: pursuit halts at the
   doorway, the threat withdraws, corridor light returns,
   `THREAT FOUNDATION COMPLETE` appears. Re-entering the control room
   afterwards re-triggers nothing.

## D. Tooling

9. F1 overlay on/off; verify markers dispose. `resetThreat` via the bridge
   replays the whole sequence. Production build: F1 dead,
   `window.__TLS_TEST__` undefined, no threat until the reveal.
