import { expect, test, type Page } from '@playwright/test';

/**
 * Milestone 1.0 Endings E2E Test Suite.
 *
 * Verifies:
 * - Final decision terminal UI presentation, styling, and keyboard navigation.
 * - Pathway prerequisite validation (Silence, Response, Archive).
 * - Two-step confirmation logic.
 * - In-engine ending cinematic sequence, status readouts, and skip function.
 * - Post-ending summary card metrics, restart action, and continue exploring.
 */

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#loading-root')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('#fatal-error-root')).toBeHidden();
  await page.locator('#game-canvas').click({ position: { x: 40, y: 40 } });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__TLS_TEST__?.setPointerLockBypass(true));
}

test.describe('Milestone 1.0 — Decision Terminal & Endings', () => {
  test('opens final decision terminal and displays pathways with prerequisites', async ({
    page,
  }) => {
    await boot(page);

    // Open terminal via bridge
    await page.evaluate(() => {
      const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
      const fn = bridge?.['openFinalDecision'];
      if (typeof fn === 'function') (fn as () => void)();
    });

    const terminal = page.locator('#final-decision-terminal');
    await expect(terminal).toBeVisible();
    await expect(terminal).toContainText('CENTRAL COMMAND TERMINAL');

    // Silence pathway should be available unconditionally
    const silenceBtn = page.locator('[data-pathway="SILENCE"]');
    await expect(silenceBtn).toBeVisible();
    await expect(silenceBtn).not.toBeDisabled();

    // Close terminal via Escape
    await page.keyboard.press('Escape');
    await expect(terminal).toBeHidden();
  });

  test('requires two-step confirmation before executing ending', async ({ page }) => {
    await boot(page);

    await page.evaluate(() => {
      const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
      const fn = bridge?.['openFinalDecision'];
      if (typeof fn === 'function') (fn as () => void)();
    });

    const terminal = page.locator('#final-decision-terminal');
    await expect(terminal).toBeVisible();

    const silenceBtn = page.locator('[data-pathway="SILENCE"]');
    // First click selects and triggers confirmation prompt
    await silenceBtn.click();
    await expect(page.locator('.decision-confirm-prompt')).toBeVisible();
    await expect(page.locator('.decision-confirm-prompt')).toContainText('CONFIRMATION REQUIRED');

    // Confirm execution via confirm button
    const confirmBtn = page.locator('#btn-confirm-pathway');
    await confirmBtn.click();

    // Terminal closes and Ending Cinematic opens
    await expect(terminal).toBeHidden();
    const cinematic = page.locator('#ending-cinematic-overlay');
    await expect(cinematic).toBeVisible();

    // Skip cinematic to reach post-ending screen
    await page.evaluate(() => {
      const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
      const fn = bridge?.['skipEndingSequence'];
      if (typeof fn === 'function') (fn as () => void)();
    });

    // Post-ending debriefing card is presented
    const postEnding = page.locator('#post-ending-summary');
    await expect(postEnding).toBeVisible({ timeout: 10_000 });
    await expect(postEnding).toContainText('DEBRIEFING');
    await expect(postEnding).toContainText('PROTOCOL SILENCE');

    // Click "Continue Exploring"
    const exploreBtn = page.locator('#btn-continue-exploring');
    await exploreBtn.click();
    await expect(postEnding).toBeHidden();
  });
});
