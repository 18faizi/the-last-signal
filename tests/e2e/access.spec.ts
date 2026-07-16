import { expect, test, type Page } from '@playwright/test';

/**
 * Milestone 0.4 access and inventory browser tests.
 *
 * All item collection and door interaction are driven through the dev bridge
 * (collectPickup, openDoor, getInventorySnapshot, getDoorState) since headless
 * CI cannot aim precisely. The bridge surface is minimal — it exercises the
 * same code paths as real player interaction.
 *
 * Timing: headless SwiftShader runs slowly; all polls have generous timeouts.
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
  await page.goto('/?scene=access-test');
  await expect(page.locator('#loading-root')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('#fatal-error-root')).toBeHidden();
  await page.locator('#game-canvas').click({ position: { x: 40, y: 40 } });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__TLS_TEST__?.setPointerLockBypass(true));
}

async function inv(page: Page) {
  // page.evaluate serialises the return value as JSON, stripping methods.
  // We reconstruct has() and getQuantity() on the Node.js side from entries.
  type RawEntry = { itemId: string; quantity: number };
  type RawSnap = { itemCount: number; entries: RawEntry[] };
  const raw = await page.evaluate((): RawSnap | undefined => {
    const s = window.__TLS_TEST__?.getInventorySnapshot?.();
    if (s === undefined) return undefined;
    return { itemCount: s.itemCount, entries: Array.from(s.entries) };
  });
  if (raw === undefined || raw === null) return undefined;
  return {
    itemCount: raw.itemCount,
    entries: raw.entries,
    has: (itemId: string) => raw.entries.some((e) => e.itemId === itemId && e.quantity > 0),
    getQuantity: (itemId: string) => raw.entries.find((e) => e.itemId === itemId)?.quantity ?? 0,
  };
}

function doorState(page: Page, doorId: string) {
  return page.evaluate((id: string) => window.__TLS_TEST__?.getDoorState?.(id), doorId);
}

function collectPickup(page: Page, pickupId: string) {
  return page.evaluate((id: string) => window.__TLS_TEST__?.collectPickup?.(id), pickupId);
}

function openDoor(page: Page, doorId: string) {
  return page.evaluate((id: string) => window.__TLS_TEST__?.openDoor?.(id), doorId);
}

test('access-test scene boots and shows milestone marker', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  await expect(page.getByTestId('ready-marker')).toHaveText('Milestone 0.4 — Access and Inventory');
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('bridge is available and inventory starts empty', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const snapshot = await inv(page);
  expect(snapshot).toBeDefined();
  expect(snapshot?.itemCount).toBe(0);
});

test('area A: direct pickup adds key to inventory', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  await collectPickup(page, 'at-pickup-maintenance-key');
  await page.waitForTimeout(100);

  const snapshot = await inv(page);
  expect(snapshot?.has('at-maintenance-key')).toBe(true);
  expect(snapshot?.getQuantity('at-maintenance-key')).toBe(1);
});

test('area A: maintenance key unlocks door A', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const doorId = 'at-door-area-a';

  // Locked before collecting.
  const before = await doorState(page, doorId);
  expect(before?.access).toBe('locked');

  // Collect key.
  await collectPickup(page, 'at-pickup-maintenance-key');
  await page.waitForTimeout(100);

  // Open door.
  const opened = await openDoor(page, doorId);
  expect(opened).toBe(true);

  // Wait for door to start opening.
  await expect
    .poll(() => doorState(page, doorId), { timeout: 5000 })
    .toMatchObject({ access: 'unlocked' });

  // Key is retained.
  const snap = await inv(page);
  expect(snap?.has('at-maintenance-key')).toBe(true);
});

test('area A: door stays locked without key (wrong key)', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const doorId = 'at-door-area-a';

  // Collect the wrong key instead.
  await collectPickup(page, 'at-pickup-wrong-key');
  await page.waitForTimeout(100);

  // Attempt to open — should be denied.
  const opened = await openDoor(page, doorId);
  expect(opened).toBe(false);

  const after = await doorState(page, doorId);
  expect(after?.access).toBe('locked');
  expect(after?.physical).toBe('closed');
});

test('area B: inspect-before-collect card — collect() adds card', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  // collectPickup uses the collect() path for InspectablePickupTarget.
  await collectPickup(page, 'at-pickup-security-card');
  await page.waitForTimeout(100);

  const snap = await inv(page);
  expect(snap?.has('at-security-card')).toBe(true);
});

test('area C: hold pickup consume-one removes one unit on door use', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const doorId = 'at-door-area-c';

  // Collect two bypass tools.
  await collectPickup(page, 'at-pickup-bypass-tool');
  await collectPickup(page, 'at-pickup-bypass-tool-2');
  await page.waitForTimeout(100);

  const snapBefore = await inv(page);
  expect(snapBefore?.getQuantity('at-bypass-tool')).toBe(2);

  // Unlock door C (consume-one).
  await openDoor(page, doorId);
  await page.waitForTimeout(100);

  const snapAfter = await inv(page);
  // One unit consumed.
  expect(snapAfter?.getQuantity('at-bypass-tool')).toBe(1);
});

test('area D: AnyOf — key-A alone satisfies the lock', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const doorId = 'at-door-area-d';

  await collectPickup(page, 'at-pickup-maintenance-key');
  await page.waitForTimeout(100);

  const opened = await openDoor(page, doorId);
  expect(opened).toBe(true);

  await expect
    .poll(() => doorState(page, doorId), { timeout: 5000 })
    .toMatchObject({ access: 'unlocked' });
});

test('area D: AnyOf — card-B alone satisfies the lock', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const doorId = 'at-door-area-d';

  await collectPickup(page, 'at-pickup-security-card');
  await page.waitForTimeout(100);

  const opened = await openDoor(page, doorId);
  expect(opened).toBe(true);

  await expect
    .poll(() => doorState(page, doorId), { timeout: 5000 })
    .toMatchObject({ access: 'unlocked' });
});

test('area E: AllOf — both key-A and card-B required', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const doorId = 'at-door-area-e';

  // Only card — AllOf fails.
  await collectPickup(page, 'at-pickup-security-card');
  await page.waitForTimeout(100);
  expect(await openDoor(page, doorId)).toBe(false);

  // Add key — AllOf should now pass.
  await collectPickup(page, 'at-pickup-maintenance-key');
  await page.waitForTimeout(100);
  expect(await openDoor(page, doorId)).toBe(true);

  await expect
    .poll(() => doorState(page, doorId), { timeout: 5000 })
    .toMatchObject({ access: 'unlocked' });
});

test('door state observable after open door', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  await collectPickup(page, 'at-pickup-maintenance-key');
  await page.waitForTimeout(100);
  await openDoor(page, 'at-door-area-a');

  // Wait for door to begin opening.
  await expect
    .poll(() => doorState(page, 'at-door-area-a'), { timeout: 3000 })
    .toMatchObject({ physical: 'opening' });
});

test('inventory notification appears on item pickup', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  await collectPickup(page, 'at-pickup-maintenance-key');
  // Notification should appear briefly.
  await expect(page.locator('#inventory-notification')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('#inventory-notification')).toContainText('Maintenance Key');
});

test('multiple pickups and full inventory lifecycle', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  // Collect three items.
  await collectPickup(page, 'at-pickup-maintenance-key');
  await collectPickup(page, 'at-pickup-security-card');
  await collectPickup(page, 'at-pickup-bypass-tool');
  await page.waitForTimeout(100);

  const snap = await inv(page);
  expect(snap?.itemCount).toBe(3);

  // Unlock door A (retain) and door B (retain) and door C (consume-one).
  await openDoor(page, 'at-door-area-a');
  await openDoor(page, 'at-door-area-b');
  await openDoor(page, 'at-door-area-c');
  await page.waitForTimeout(100);

  // Key A and card B retained; bypass tool consumed.
  const snapAfter = await inv(page);
  expect(snapAfter?.has('at-maintenance-key')).toBe(true);
  expect(snapAfter?.has('at-security-card')).toBe(true);
  expect(snapAfter?.has('at-bypass-tool')).toBe(false);

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('lifecycle: repeated collect+unlock does not leak resources', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const before = await page.evaluate(() => window.__TLS_TEST__?.getDiagnostics?.());

  for (let i = 0; i < 5; i++) {
    await collectPickup(page, 'at-pickup-bypass-tool');
    await page.waitForTimeout(50);
    // Just exercise the bridge; bypass tool may hit maxStack quickly.
  }
  await openDoor(page, 'at-door-area-a'); // this will fail (no key) — that's fine

  const after = await page.evaluate(() => window.__TLS_TEST__?.getDiagnostics?.());
  if (before !== undefined && after !== undefined) {
    expect(after.cameraCount).toBe(before.cameraCount);
    expect(after.beforeRenderObserverCount).toBe(before.beforeRenderObserverCount);
  }

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});
