import { expect, test, type Page } from '@playwright/test';

/**
 * Milestone 0.3 interaction browser tests.
 *
 * Focus/prompt/hold flows are driven through real movement and the focus
 * raycast. Inspection and document flows additionally use the dev bridge's
 * `activateTarget` (documented in docs/development/testing.md) because
 * headless CI cannot aim the camera precisely; the activation path taken is
 * identical to a real E press on a focused target.
 *
 * Timing note: headless SwiftShader runs well below 60 FPS and the
 * simulation clamps delta time, so wall-clock waits here are generous.
 */

async function boot(page: Page, errors: { console: string[]; page: string[] }): Promise<void> {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.console.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    errors.page.push(error.message);
  });
  await page.goto('/');
  await expect(page.locator('#loading-root')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('#fatal-error-root')).toBeHidden();
  await page.locator('#game-canvas').click({ position: { x: 40, y: 40 } });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__TLS_TEST__?.setPointerLockBypass(true));
}

function interactionState(page: Page) {
  return page.evaluate(() => window.__TLS_TEST__?.getInteractionState?.());
}

/** Strafe in short taps until the given target holds focus after settling. */
async function strafeUntilFocused(page: Page, key: string, targetId: string): Promise<void> {
  for (let i = 0; i < 60; i += 1) {
    const settled = await interactionState(page);
    if (settled?.focusedId === targetId) {
      const player = await page.evaluate(() => window.__TLS_TEST__?.getPlayerState());
      if ((player?.horizontalSpeed ?? 1) < 0.05) {
        return;
      }
      await page.waitForTimeout(150);
      continue;
    }
    await page.keyboard.down(key);
    await page.waitForTimeout(220);
    await page.keyboard.up(key);
    await page.waitForTimeout(260);
  }
  throw new Error(`never acquired stable focus on ${targetId}`);
}

/** Walk forward until the toggle switch (straight ahead of spawn) has focus. */
async function walkToConsole(page: Page): Promise<void> {
  await page.keyboard.down('KeyW');
  await expect
    .poll(async () => (await interactionState(page))?.focusedId ?? null, { timeout: 15_000 })
    .toBe('test-toggle-switch');
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(300);
}

test('scene loads with the milestone marker and interaction prompt flow', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  await expect(page.getByTestId('ready-marker')).toHaveText(
    'Milestone 0.3 — Interaction Framework',
  );

  // No prompt before anything is focused.
  await expect(page.locator('#interaction-prompt')).toBeHidden();

  await walkToConsole(page);
  await expect(page.locator('#interaction-prompt')).toBeVisible();
  await expect(page.locator('#interaction-prompt')).toContainText('USE SWITCH');
  await expect(page.locator('.interaction-prompt-key')).toHaveText('[E]');

  // Immediate interaction executes without errors and stays focused.
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  const after = await interactionState(page);
  expect(after?.focusedId).toBe('test-toggle-switch');
  expect(after?.mode).toBe('gameplay');

  expect(errors.page).toEqual([]);
  expect(errors.console).toEqual([]);
});

test('hold interaction shows progress, cancels on release, completes once', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  await walkToConsole(page);

  // Strafe right in short taps until the breaker has stable focus —
  // continuous strafing overshoots under SwiftShader's low frame rate.
  await strafeUntilFocused(page, 'KeyD', 'test-breaker');
  await expect(page.locator('.interaction-prompt-key')).toHaveText('[HOLD E]');

  // Partial hold shows progress...
  await page.keyboard.down('KeyE');
  await expect
    .poll(async () => (await interactionState(page))?.holdProgress ?? 0, { timeout: 5_000 })
    .toBeGreaterThan(0.1);
  await expect(page.locator('.interaction-hold-track')).toBeVisible();
  // ...and releasing early cancels without completing.
  await page.keyboard.up('KeyE');
  await page.waitForTimeout(300);
  const cancelled = await interactionState(page);
  expect(cancelled?.holdProgress).toBe(0);
  expect(cancelled?.availability).toBe('available');
  await expect(page.locator('.interaction-hold-track')).toBeHidden();

  // A full hold completes exactly once: the breaker becomes disabled
  // (BREAKER READY) and further holding cannot re-trigger it.
  await page.keyboard.down('KeyE');
  await expect
    .poll(async () => (await interactionState(page))?.availability ?? '', { timeout: 15_000 })
    .toBe('disabled');
  await page.waitForTimeout(600); // keep holding after completion
  await page.keyboard.up('KeyE');
  await expect(page.locator('#interaction-prompt')).toContainText('BREAKER READY');
  await expect(page.locator('.interaction-prompt-key')).toBeHidden();

  expect(errors.page).toEqual([]);
  expect(errors.console).toEqual([]);
});

test('disabled target shows its reason without a key hint', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  await walkToConsole(page);

  // Strafe right past the breaker to the disabled panel.
  await strafeUntilFocused(page, 'KeyD', 'test-disabled-panel');
  await expect(page.locator('#interaction-prompt')).toContainText('REQUIRES POWER');
  await expect(page.locator('.interaction-prompt-key')).toBeHidden();

  expect(errors.page).toEqual([]);
  expect(errors.console).toEqual([]);
});

test('inspection opens, rotates, zooms, and closes without moving the player', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const before = await page.evaluate(() => window.__TLS_TEST__?.getPlayerState());
  const opened = await page.evaluate(
    () => window.__TLS_TEST__?.activateTarget?.('test-field-radio') ?? false,
  );
  expect(opened).toBe(true);
  await expect(page.locator('#inspection-overlay')).toBeVisible();
  await expect(page.locator('#inspection-overlay')).toContainText('FIELD RADIO');

  // Locomotion is suspended: movement keys must not change position.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyW');
  const during = await page.evaluate(() => window.__TLS_TEST__?.getPlayerState());
  expect(Math.abs((during?.position.z ?? 0) - (before?.position.z ?? 0))).toBeLessThan(0.01);

  // Pointer movement rotates the model; wheel zooms within limits.
  await page.mouse.move(640, 360);
  await page.mouse.move(800, 460);
  await expect
    .poll(async () => (await interactionState(page))?.inspectionView?.yaw ?? 0)
    .not.toBe(0);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(200);
  const zoomed = await interactionState(page);
  expect(zoomed?.inspectionView?.radius).toBeLessThan(1.3);

  // R resets the orientation (dev respawn is suppressed while locked).
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(200);
  const reset = await interactionState(page);
  expect(reset?.inspectionView?.yaw).toBe(0);
  expect(reset?.inspectionView?.radius).toBeCloseTo(1.3);

  // Escape closes and gameplay resumes with no input locks (mode flips on
  // the next frame tick).
  await page.keyboard.press('Escape');
  await expect(page.locator('#inspection-overlay')).toBeHidden();
  await expect
    .poll(async () => (await interactionState(page))?.mode ?? '', { timeout: 5_000 })
    .toBe('gameplay');
  const closed = await interactionState(page);
  expect(closed?.suspensionReasons).toEqual([]);

  // Movement works again after closing.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyW');
  const resumed = await page.evaluate(() => window.__TLS_TEST__?.getPlayerState());
  expect((resumed?.position.z ?? 0) - (before?.position.z ?? 0)).toBeGreaterThan(0.3);

  expect(errors.page).toEqual([]);
  expect(errors.console).toEqual([]);
});

test('document reader opens, scrolls, closes and restores gameplay', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const opened = await page.evaluate(
    () => window.__TLS_TEST__?.activateTarget?.('test-shift-log') ?? false,
  );
  expect(opened).toBe(true);
  await expect(page.locator('#document-reader')).toBeVisible();
  await expect(page.locator('.document-article h1')).toHaveText('SHIFT LOG — RECEIVER STATION');
  await expect(page.locator('.document-article')).toContainText('calibration artifact');

  // Prompt UI is hidden while reading; the long document scrolls.
  await expect(page.locator('#interaction-prompt')).toBeHidden();
  await page.locator('.document-article').evaluate((element) => {
    element.scrollTop = 300;
  });
  await expect
    .poll(async () => (await interactionState(page))?.documentScrollTop ?? 0)
    .toBeGreaterThan(200);

  // Escape closes; input locks release; the mode returns to gameplay on the
  // next frame tick.
  await page.keyboard.press('Escape');
  await expect(page.locator('#document-reader')).toBeHidden();
  await expect
    .poll(async () => (await interactionState(page))?.mode ?? '', { timeout: 5_000 })
    .toBe('gameplay');
  const closed = await interactionState(page);
  expect(closed?.suspensionReasons).toEqual([]);

  const before = await page.evaluate(() => window.__TLS_TEST__?.getPlayerState());
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => window.__TLS_TEST__?.getPlayerState());
  expect((after?.position.z ?? 0) - (before?.position.z ?? 0)).toBeGreaterThan(0.3);

  expect(errors.page).toEqual([]);
  expect(errors.console).toEqual([]);
});

test('20x inspection/document repetition does not leak resources', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  // Warm-up session creates the reusable inspection camera/light once.
  await page.evaluate(() => window.__TLS_TEST__?.activateTarget?.('test-field-radio'));
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__TLS_TEST__?.closeOverlays?.());
  await page.waitForTimeout(250);

  const baseline = await page.evaluate(() => window.__TLS_TEST__?.getDiagnostics?.());
  expect(baseline).toBeDefined();

  for (let i = 0; i < 20; i += 1) {
    await page.evaluate(() => window.__TLS_TEST__?.activateTarget?.('test-field-radio'));
    await page.waitForTimeout(120);
    await page.mouse.move(600 + (i % 3) * 40, 340 + (i % 2) * 30);
    await page.evaluate(() => window.__TLS_TEST__?.closeOverlays?.());
    await page.waitForTimeout(120);
    await page.evaluate(() => window.__TLS_TEST__?.activateTarget?.('test-shift-log'));
    await page.waitForTimeout(120);
    await page.locator('.document-article').evaluate((element) => {
      element.scrollTop = 200;
    });
    await page.evaluate(() => window.__TLS_TEST__?.closeOverlays?.());
    await page.waitForTimeout(120);
  }

  const final = await page.evaluate(() => window.__TLS_TEST__?.getDiagnostics?.());
  expect(final).toBeDefined();
  expect(final?.cameraCount).toBe(baseline?.cameraCount);
  expect(final?.meshCount).toBe(baseline?.meshCount);
  expect(final?.beforeRenderObserverCount).toBe(baseline?.beforeRenderObserverCount);
  expect(final?.promptElementCount).toBe(1);
  expect(final?.readerElementCount).toBe(1);
  expect(final?.inspectionOverlayCount).toBe(1);

  // Interaction still works after the churn.
  const reopened = await page.evaluate(
    () => window.__TLS_TEST__?.activateTarget?.('test-field-radio') ?? false,
  );
  expect(reopened).toBe(true);
  await expect(page.locator('#inspection-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#inspection-overlay')).toBeHidden();

  expect(errors.page).toEqual([]);
  expect(errors.console).toEqual([]);
});
