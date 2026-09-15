/**
 * Unit tests for NarrativeFactRegistry.
 */

import { describe, expect, it, vi } from 'vitest';
import { NarrativeFactRegistry } from '../../game/narrative/NarrativeFactRegistry';

describe('NarrativeFactRegistry', () => {
  it('initializes with no discovered facts', () => {
    const registry = new NarrativeFactRegistry();
    expect(registry.getDiscoveredFacts()).toEqual([]);
    expect(registry.hasFact('SecurityLogRead')).toBe(false);
  });

  it('unlocks facts and notifies listeners', () => {
    const registry = new NarrativeFactRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);

    const unlocked = registry.unlockFact('SecurityLogRead', 5000);
    expect(unlocked).toBe(true);
    expect(registry.hasFact('SecurityLogRead')).toBe(true);
    expect(registry.getDiscoveryTimestamp('SecurityLogRead')).toBe(5000);
    expect(listener).toHaveBeenCalledWith('SecurityLogRead', 5000);

    // Unlocking again returns false and does not notify
    const reUnlocked = registry.unlockFact('SecurityLogRead', 6000);
    expect(reUnlocked).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('captures and restores snapshots', () => {
    const registry = new NarrativeFactRegistry();
    registry.unlockFact('SecurityLogRead', 1000);
    registry.unlockFact('LocalLoopResultRevealed', 2000);

    const snapshot = registry.captureSnapshot();
    expect(snapshot.discoveredFacts).toContain('SecurityLogRead');
    expect(snapshot.discoveredFacts).toContain('LocalLoopResultRevealed');
    expect(snapshot.discoveryTimestamps['LocalLoopResultRevealed']).toBe(2000);

    const fresh = new NarrativeFactRegistry();
    fresh.restoreSnapshot(snapshot);

    expect(fresh.hasFact('SecurityLogRead')).toBe(true);
    expect(fresh.hasFact('LocalLoopResultRevealed')).toBe(true);
    expect(fresh.hasFact('FirstTransmissionDecoded')).toBe(false);
    expect(fresh.getDiscoveryTimestamp('LocalLoopResultRevealed')).toBe(2000);
  });

  it('resets correctly', () => {
    const registry = new NarrativeFactRegistry();
    registry.unlockFact('SecurityLogRead');
    registry.reset();
    expect(registry.getDiscoveredFacts()).toEqual([]);
    expect(registry.hasFact('SecurityLogRead')).toBe(false);
  });
});
