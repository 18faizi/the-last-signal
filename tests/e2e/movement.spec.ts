import { expect, test, type Page } from '@playwright/test';

/**
 * Milestone 0.2 movement smoke tests.
 *
 * Drives the first-person controller through the development test bridge
 * (`window.__TLS_TEST__`, dev-only — see docs/development/testing.md).
 * Headless Chromium does not reliably grant pointer lock, so after a real
 * click on the canvas the test enables the bridge's pointer-lock bypass if
 * lock was not acquired; every assertion beyond that point exercises the
 * same movement path a locked player uses.
 */

interface BridgePlayerState {
  position: { x: number; y: number; z: number };
  horizontalSpeed: number;
  verticalVelocity: number;
  grounded: boolean;
  mode: string;
  crouched: boolean;
  pointerLocked: boolean;
  yaw: number;
  pitch: number;
}

async function getPlayerState(page: Page): Promise<BridgePlayerState> {
  const state = await page.evaluate(() => window.__TLS_TEST__?.getPlayerState());
  expect(state, 'test bridge must be installed in development').toBeDefined();
  return state as BridgePlayerState;
}

async function bootIntoMovementScene(
  page: Page,
  errors: { console: string[]; page: string[] },
): Promise<void> {
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

  // Pointer-lock prompt is visible before any interaction.
  await expect(page.locator('#pointer-lock-prompt')).toBeVisible();
  await expect(page.locator('#pointer-lock-prompt')).toContainText('Click to enter');

  // A real user gesture on the canvas requests pointer lock. Click near the
  // corner: the centered prompt element would otherwise intercept the click
  // (clicking the prompt works too, but the milestone requires a canvas click).
  await page.locator('#game-canvas').click({ position: { x: 40, y: 40 } });
  await page.waitForTimeout(300);
  const locked = (await getPlayerState(page)).pointerLocked;
  if (!locked) {
    // Headless environment denied the lock; fall back to the dev bypass.
    await page.evaluate(() => window.__TLS_TEST__?.setPointerLockBypass(true));
  }
}

test('player can walk, stop, jump and crouch through the movement course', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await bootIntoMovementScene(page, errors);

  const start = await getPlayerState(page);
  expect(start.grounded).toBe(true);
  expect(start.mode).toBe('idle');

  // Walk forward: position must advance along the facing direction.
  // The access-test scene spawn faces +X (yaw=π/2), so use horizontal
  // distance to avoid axis coupling.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1000);
  const walking = await getPlayerState(page);
  expect(walking.mode).toBe('walking');
  expect(walking.horizontalSpeed).toBeGreaterThan(1);
  const walkDist = Math.hypot(
    walking.position.x - start.position.x,
    walking.position.z - start.position.z,
  );
  expect(walkDist).toBeGreaterThan(1);

  // Releasing input decelerates to a stop.
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(600);
  const stopped = await getPlayerState(page);
  expect(stopped.horizontalSpeed).toBeLessThan(0.05);
  expect(stopped.mode).toBe('idle');

  // Jump: vertical state must change (airborne, then settle back grounded).
  // Use expect.poll: the facility scene has grown substantially heavier
  // (doors, power network, receiver console) since this timeout was last
  // tuned, so under loaded SwiftShader it can take longer than a second to
  // register the first airborne frame.
  await page.keyboard.press('Space');
  await expect
    .poll(() => getPlayerState(page).then((s) => s.grounded), { timeout: 3000 })
    .toBe(false);
  const airborne = await getPlayerState(page);
  expect(airborne.mode).toBe('airborne');
  await page.waitForTimeout(1500);
  const landed = await getPlayerState(page);
  expect(landed.grounded).toBe(true);

  // Crouch: mode and stance flags change while held, and revert on release.
  await page.keyboard.down('KeyC');
  await page.waitForTimeout(300);
  const crouched = await getPlayerState(page);
  expect(crouched.crouched).toBe(true);
  expect(crouched.mode).toBe('crouching');
  await page.keyboard.up('KeyC');
  await page.waitForTimeout(300);
  const standing = await getPlayerState(page);
  expect(standing.crouched).toBe(false);

  // Sprint: hold shift + forward and verify the sprint mode engages.
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(700);
  const sprinting = await getPlayerState(page);
  expect(sprinting.mode).toBe('sprinting');
  expect(sprinting.horizontalSpeed).toBeGreaterThan(4);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');

  expect(errors.page, `Unexpected page errors:\n${errors.page.join('\n')}`).toEqual([]);
  expect(errors.console, `Unexpected console errors:\n${errors.console.join('\n')}`).toEqual([]);
});

test('debug overlay exposes controller state fields', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await bootIntoMovementScene(page, errors);

  await page.keyboard.press('Backquote');
  const overlay = page.locator('#debug-overlay-root');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('Player pos');
  await expect(overlay).toContainText('Mode');
  await expect(overlay).toContainText('Grounded');
  await expect(overlay).toContainText('Crouch');
  await expect(overlay).toContainText('Pointer lock');
  await expect(overlay).toContainText('Yaw/Pitch');
  await page.keyboard.press('Backquote');
  await expect(overlay).toBeHidden();

  expect(errors.page).toEqual([]);
  expect(errors.console).toEqual([]);
});
