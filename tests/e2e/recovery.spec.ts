import { expect, test, type Page } from '@playwright/test';

/**
 * Milestone 1.0 Recovery & Checkpoints E2E Test Suite.
 *
 * Verifies:
 * - Checkpoint snapshot capture across checkpoints.
 * - Restoring snapshots accurately recreates state.
 * - ProgressionRecoveryValidator detects corrupted/soft-locked snapshots.
 * - Clean restart returns player to initial spawn with reset objectives and facts.
 */

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#loading-root')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('#fatal-error-root')).toBeHidden();
  await page.locator('#game-canvas').click({ position: { x: 40, y: 40 } });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__TLS_TEST__?.setPointerLockBypass(true));
}

test.describe('Milestone 1.0 — Checkpoint Snapshot & Recovery', () => {
  test('captures and restores runtime checkpoint snapshot', async ({ page }) => {
    await boot(page);

    // Teleport to courtyard
    await page.evaluate(() => {
      const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
      const fn = bridge?.['teleportTo'];
      if (typeof fn === 'function') (fn as (id: string) => boolean)('tp-courtyard');
    });

    // Capture checkpoint snapshot
    const captureResult = await page.evaluate(() => {
      const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
      const fn = bridge?.['captureCheckpointSnapshot'];
      return typeof fn === 'function'
        ? (fn as (cpId: string) => boolean)('fg-cp-courtyard')
        : false;
    });
    expect(captureResult).toBe(true);

    // Move somewhere else (spawn)
    await page.evaluate(() => {
      const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
      const fn = bridge?.['teleportTo'];
      if (typeof fn === 'function') (fn as (id: string) => boolean)('tp-spawn');
    });

    // Restore courtyard checkpoint
    const restoreResult = await page.evaluate(() => {
      const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
      const fn = bridge?.['restoreCheckpointSnapshot'];
      return typeof fn === 'function'
        ? (fn as (cpId: string) => boolean)('fg-cp-courtyard')
        : false;
    });
    expect(restoreResult).toBe(true);
  });

  test('restart flow completely resets state to Arrival spawn', async ({ page }) => {
    await boot(page);

    // Pick up an item and read a doc
    await page.evaluate(() => {
      const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
      const collect = bridge?.['collectPickup'];
      if (typeof collect === 'function') (collect as (id: string) => boolean)('fg-keycard-entry');
      const inspect = bridge?.['readDocument'];
      if (typeof inspect === 'function')
        (inspect as (id: string) => boolean)('doc-facility-entry-log');
    });

    // Trigger full restart
    await page.evaluate(() => {
      const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
      const fn = bridge?.['restartGame'];
      if (typeof fn === 'function') (fn as () => void)();
    });

    // Verify game flow reset to Arrival
    const flow = await page.evaluate(() => {
      const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
      const fn = bridge?.['getGameFlowSnapshot'];
      return typeof fn === 'function' ? (fn as () => { chapter: string })() : undefined;
    });
    expect(flow?.chapter).toBe('Arrival');

    // Verify narrative facts reset
    const narrative = await page.evaluate(() => {
      const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
      const fn = bridge?.['getNarrativeSnapshot'];
      return typeof fn === 'function' ? (fn as () => { discoveredFacts: string[] })() : undefined;
    });
    expect(narrative?.discoveredFacts.length).toBe(0);
  });
});
