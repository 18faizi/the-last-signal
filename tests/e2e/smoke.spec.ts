import { expect, test } from '@playwright/test';

/**
 * Application boot smoke test (Milestone 0.1 foundation, current boot scene).
 *
 * Verifies the full startup path in headless Chromium: loading screen,
 * engine init (WebGL fallback — headless CI has no WebGPU), Havok physics,
 * scene creation, and the development debug overlay. Fails on any unexpected
 * console error or page error.
 */

// Babylon logs an informational line about the engine version; anything else
// on console.error fails the test.
const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
  /falling back to WebGL/i, // our own development fallback notice
];

test('application boots to the facility-greybox scene without errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      if (!IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(text))) {
        consoleErrors.push(text);
      }
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/');

  // Loading screen appears with the game title.
  await expect(page.locator('.loading-title')).toHaveText('THE LAST SIGNAL');

  // …and disappears once the initial scene is ready.
  await expect(page.locator('#loading-root')).toBeHidden({ timeout: 30_000 });

  // The canvas is present and visible.
  await expect(page.locator('#game-canvas')).toBeVisible();

  // No fatal error screen.
  await expect(page.locator('#fatal-error-root')).toBeHidden();

  // The development-ready marker is shown.
  await expect(page.getByTestId('ready-marker')).toBeVisible();
  await expect(page.getByTestId('ready-marker')).toHaveText('Milestone 0.5 — Facility Greybox');

  // Debug overlay toggles on via the backquote shortcut and shows live data.
  await page.keyboard.press('Backquote');
  await expect(page.locator('#debug-overlay-root')).toBeVisible();
  await expect(page.locator('#debug-overlay-root')).toContainText('Lifecycle');
  await expect(page.locator('#debug-overlay-root')).toContainText('running');

  // …and toggles back off.
  await page.keyboard.press('Backquote');
  await expect(page.locator('#debug-overlay-root')).toBeHidden();

  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([]);
  expect(consoleErrors, `Unexpected console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});
