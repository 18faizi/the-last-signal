import { expect, test, type Page } from '@playwright/test';

/**
 * Milestone 0.5 facility greybox browser tests.
 *
 * All navigation and item collection use the dev bridge
 * (collectPickup, openDoor, getInventorySnapshot, getDoorState, teleportTo,
 *  getFacilityState) since headless CI cannot aim precisely.
 *
 * Timing: headless SwiftShader runs slowly; all polls use generous timeouts.
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

// Bridge helpers
function getFacilityState(page: Page) {
  return page.evaluate(() => {
    const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
    const fn = bridge?.['getFacilityState'];
    if (typeof fn === 'function') {
      type FacilityStateResult = {
        progressionPhase: string;
        isComplete: boolean;
        collectedPickupIds: string[];
        openedDoorIds: string[];
        discoveredZoneIds: string[];
      };
      return (fn as () => FacilityStateResult)();
    }
    return undefined;
  });
}

function teleportTo(page: Page, id: string) {
  return page.evaluate((teleportId: string) => {
    const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
    const fn = bridge?.['teleportTo'];
    return typeof fn === 'function' ? (fn as (id: string) => boolean)(teleportId) : false;
  }, id);
}

async function inv(page: Page) {
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

function collectPickup(page: Page, pickupId: string) {
  return page.evaluate((id: string) => window.__TLS_TEST__?.collectPickup?.(id), pickupId);
}

function doorState(page: Page, doorId: string) {
  return page.evaluate((id: string) => window.__TLS_TEST__?.getDoorState?.(id), doorId);
}

function openDoor(page: Page, doorId: string) {
  return page.evaluate((id: string) => window.__TLS_TEST__?.openDoor?.(id), doorId);
}

// ---------------------------------------------------------------------------

test('facility scene boots and shows milestone marker', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  await expect(page.getByTestId('ready-marker')).toHaveText('Milestone 0.6 — Power Network');
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('dev bridge is available and facility state starts at Approach', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const state = await getFacilityState(page);
  expect(state).toBeDefined();
  expect(state?.progressionPhase).toBe('Approach');
  expect(state?.isComplete).toBe(false);

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('inventory starts empty', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const snapshot = await inv(page);
  expect(snapshot?.itemCount).toBe(0);
});

test('compound gate key pickup adds item to inventory', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  await collectPickup(page, 'fg-pickup-compound-gate-key');
  await page.waitForTimeout(100);

  const snapshot = await inv(page);
  expect(snapshot?.has('fg-compound-gate-key')).toBe(true);
});

test('compound gate requires key and opens with it', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const doorId = 'fg-door-compound-gate';

  // Door is locked before collecting key.
  const before = await doorState(page, doorId);
  expect(before?.access).toBe('locked');

  // Collect the key.
  await collectPickup(page, 'fg-pickup-compound-gate-key');
  await page.waitForTimeout(100);

  // Open the door.
  const result = await openDoor(page, doorId);
  expect(result).toBe(true);

  await expect
    .poll(() => doorState(page, doorId), { timeout: 5000 })
    .toMatchObject({ access: 'unlocked' });

  // Key is retained.
  const snapshot = await inv(page);
  expect(snapshot?.has('fg-compound-gate-key')).toBe(true);
});

test('tunnel shortcut: AnyOf — gate key alone satisfies lock', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  await collectPickup(page, 'fg-pickup-compound-gate-key');
  await page.waitForTimeout(100);

  const result = await openDoor(page, 'fg-door-tunnel-shortcut');
  expect(result).toBe(true);
});

test('tunnel shortcut: AnyOf — maintenance card alone satisfies lock', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  await collectPickup(page, 'fg-pickup-maintenance-card');
  await page.waitForTimeout(100);

  const result = await openDoor(page, 'fg-door-tunnel-shortcut');
  expect(result).toBe(true);
});

test('relay room: AllOf — needs antenna card AND override seal', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const doorId = 'fg-door-relay-room';

  // Card alone — should fail.
  await collectPickup(page, 'fg-pickup-antenna-access-card');
  await page.waitForTimeout(100);
  expect(await openDoor(page, doorId)).toBe(false);

  // Add seal — should pass now.
  await collectPickup(page, 'fg-pickup-override-seal-1');
  await page.waitForTimeout(100);
  expect(await openDoor(page, doorId)).toBe(true);
});

test('override seal is consumed on relay room use', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  await collectPickup(page, 'fg-pickup-antenna-access-card');
  await collectPickup(page, 'fg-pickup-override-seal-1');
  await collectPickup(page, 'fg-pickup-override-seal-2');
  await page.waitForTimeout(100);

  const qBefore = (await inv(page))?.getQuantity('fg-override-seal') ?? 0;
  await openDoor(page, 'fg-door-relay-room');
  await page.waitForTimeout(100);

  const qAfter = (await inv(page))?.getQuantity('fg-override-seal') ?? 0;
  expect(qAfter).toBe(qBefore - 1);
});

test('teleportTo bridge function moves player to named position', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const result = await teleportTo(page, 'fg-tp-courtyard');
  expect(result).toBe(true);

  await page.waitForTimeout(200);

  // Player should now be near courtyard position
  const playerState = await page.evaluate(() => window.__TLS_TEST__?.getPlayerState());
  expect(playerState?.position.x).toBeCloseTo(10, 0);
});

test('teleportTo returns false for unknown teleport id', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const result = await teleportTo(page, 'nonexistent-tp');
  expect(result).toBe(false);
});

test('generator door requires generator key', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const doorId = 'fg-door-generator';

  // Locked without key.
  expect((await doorState(page, doorId))?.access).toBe('locked');

  // Wrong key — still locked.
  await collectPickup(page, 'fg-pickup-compound-gate-key');
  await page.waitForTimeout(100);
  expect(await openDoor(page, doorId)).toBe(false);

  // Correct key — unlocks.
  await collectPickup(page, 'fg-pickup-generator-key');
  await page.waitForTimeout(100);
  expect(await openDoor(page, doorId)).toBe(true);
});

test('supervisor door requires supervisor key', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  await collectPickup(page, 'fg-pickup-supervisor-key');
  await page.waitForTimeout(100);

  expect(await openDoor(page, 'fg-door-supervisor')).toBe(true);
});

test('rooftop door requires antenna access card', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  expect(await openDoor(page, 'fg-door-rooftop')).toBe(false);

  await collectPickup(page, 'fg-pickup-antenna-access-card');
  await page.waitForTimeout(100);

  expect(await openDoor(page, 'fg-door-rooftop')).toBe(true);
});

test('lifecycle: repeated collect+open does not leak resources', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  const before = await page.evaluate(() => window.__TLS_TEST__?.getDiagnostics?.());

  for (let i = 0; i < 5; i++) {
    await collectPickup(page, 'fg-pickup-compound-gate-key');
    await page.waitForTimeout(50);
  }
  await openDoor(page, 'fg-door-compound-gate');

  const after = await page.evaluate(() => window.__TLS_TEST__?.getDiagnostics?.());
  if (before !== undefined && after !== undefined) {
    expect(after.cameraCount).toBe(before.cameraCount);
    expect(after.beforeRenderObserverCount).toBe(before.beforeRenderObserverCount);
  }

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});
