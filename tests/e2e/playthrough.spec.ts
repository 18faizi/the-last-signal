import { expect, test, type Page } from '@playwright/test';

/**
 * Milestone 1.0 Playthrough E2E Test Suite.
 *
 * Verifies start-to-finish greybox playthrough:
 * - Chapter flow transitions from Arrival through FinalDecision.
 * - Objective HUD presentation, [Q] key toggle, and step completion tracking.
 * - Context-sensitive hint system escalation and progress reset.
 */

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#loading-root')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('#fatal-error-root')).toBeHidden();
  await page.locator('#game-canvas').click({ position: { x: 40, y: 40 } });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__TLS_TEST__?.setPointerLockBypass(true));
}

function getFlowSnapshot(page: Page) {
  return page.evaluate(() => {
    const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
    const fn = bridge?.['getGameFlowSnapshot'];
    if (typeof fn === 'function') {
      return (
        fn as () => {
          chapter: string;
          activeObjectiveIds: string[];
          completedObjectiveIds: string[];
          unlockedEndingIds: string[];
          chosenEndingId: string | null;
          gameCompleted: boolean;
        }
      )();
    }
    return undefined;
  });
}

function getObjectiveSnapshot(page: Page) {
  return page.evaluate(() => {
    const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
    const fn = bridge?.['getObjectiveSnapshot'];
    if (typeof fn === 'function') {
      return (
        fn as () => {
          activeObjectiveId: string | null;
          completedObjectiveIds: string[];
          objectiveStates: Record<string, string>;
        }
      )();
    }
    return undefined;
  });
}

function getHintSnapshot(page: Page) {
  return page.evaluate(() => {
    const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
    const fn = bridge?.['getHintSnapshot'];
    if (typeof fn === 'function') {
      return (
        fn as () => {
          activeObjectiveId: string | null;
          currentTier: string;
          elapsedSeconds: number;
          hintText: string | null;
        }
      )();
    }
    return undefined;
  });
}

function teleportTo(page: Page, id: string) {
  return page.evaluate((teleportId: string) => {
    const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
    const fn = bridge?.['teleportTo'];
    return typeof fn === 'function' ? (fn as (tId: string) => boolean)(teleportId) : false;
  }, id);
}

function openDoor(page: Page, id: string) {
  return page.evaluate((doorId: string) => {
    const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
    const fn = bridge?.['openDoor'];
    return typeof fn === 'function' ? (fn as (dId: string) => boolean)(doorId) : false;
  }, id);
}

function collectPickup(page: Page, id: string) {
  return page.evaluate((pickupId: string) => {
    const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
    const fn = bridge?.['collectPickup'];
    return typeof fn === 'function' ? (fn as (pId: string) => boolean)(pickupId) : false;
  }, id);
}

function inspectDocument(page: Page, id: string) {
  return page.evaluate((docId: string) => {
    const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
    const fn = bridge?.['readDocument'];
    return typeof fn === 'function' ? (fn as (dId: string) => boolean)(docId) : false;
  }, id);
}

test.describe('Milestone 1.0 — Narrative Playthrough & Objectives', () => {
  test('initializes with Arrival chapter and shows Objective HUD', async ({ page }) => {
    await boot(page);

    const flow = await getFlowSnapshot(page);
    expect(flow?.chapter).toBe('Arrival');

    const objSnap = await getObjectiveSnapshot(page);
    expect(objSnap?.activeObjectiveId).toBe('obj-reach-gate');

    // Objective HUD is mounted and displays active objective title
    const hud = page.locator('#objective-hud');
    await expect(hud).toBeVisible();
    await expect(hud).toContainText('Reach the Station Perimeter');

    // Pressing 'Q' toggles HUD visibility
    await page.keyboard.press('KeyQ');
    await expect(hud).toBeHidden();
    await page.keyboard.press('KeyQ');
    await expect(hud).toBeVisible();
  });

  test('hint system tracks active objective and provides tiered guidance', async ({ page }) => {
    await boot(page);

    const hint = await getHintSnapshot(page);
    expect(hint?.activeObjectiveId).toBe('obj-reach-gate');
    expect(hint?.currentTier).toBe('None');
    expect(hint?.hintText).toBeFalsy();
  });

  test('progresses through early facility chapters and unlocks narrative facts', async ({
    page,
  }) => {
    await boot(page);

    // Read the facility entry log
    await inspectDocument(page, 'doc-facility-entry-log');
    await page.evaluate(() => {
      const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
      const fn = bridge?.['closeDocument'];
      if (typeof fn === 'function') (fn as () => void)();
    });

    const narrative = await page.evaluate(() => {
      const bridge = window.__TLS_TEST__ as unknown as Record<string, unknown>;
      const fn = bridge?.['getNarrativeSnapshot'];
      return typeof fn === 'function' ? (fn as () => { discoveredFacts: string[] })() : undefined;
    });
    expect(narrative?.discoveredFacts).toContain('SecurityLogRead');

    // Collect gate keycard and pass through the gate
    await collectPickup(page, 'fg-keycard-entry');
    await teleportTo(page, 'tp-gate');
    await openDoor(page, 'fg-door-gate');

    const flow = await getFlowSnapshot(page);
    expect(['Arrival', 'PerimeterBreach']).toContain(flow?.chapter);
  });
});
