/**
 * Route/continuity state for one waveguide path (mirrors DoorState/
 * ReceiverMode's plain-string-union pattern; no transition table is needed
 * here — WaveguideController derives state purely from "does the current
 * port match the correct port", see WaveguideController.ts).
 *
 * Connected   – routed to the correct port; full continuity.
 * Disconnected – no port selected / feed physically unplugged; zero continuity.
 * Misrouted   – routed to a port, but the WRONG one (spec §23's example:
 *               the East Relay Dish feed starts routed to an inactive test
 *               port) — zero continuity, but distinct from Disconnected so
 *               UI can say "connected, just to the wrong place".
 * Damaged     – dev/narrative-reserved fault state; zero continuity.
 * Bypassed    – a manual jumper/bypass route; PARTIAL continuity (spec
 *               allows "0/1 or graded" — a bypass is a deliberately
 *               degraded-but-present signal path, distinct from a clean
 *               Connected route).
 */
export type WaveguideState = 'Connected' | 'Disconnected' | 'Misrouted' | 'Damaged' | 'Bypassed';

/** Graded continuity contribution per state — consumed by AntennaEvaluator via AntennaController.setWaveguideQuality(). */
export function continuityForWaveguideState(state: WaveguideState): number {
  switch (state) {
    case 'Connected':
      return 1;
    case 'Bypassed':
      return 0.5;
    case 'Misrouted':
    case 'Disconnected':
    case 'Damaged':
      return 0;
  }
}
