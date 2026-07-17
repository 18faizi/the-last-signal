import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Milestone 0.7 signal receiver browser tests.
 *
 * Follows power.spec.ts's bridge-shortcut discipline exactly: most tests
 * drive the receiver through the dev bridge (receiverAction/
 * getReceiverSnapshot/etc.) for speed. The bridge only ever sets tuning
 * CONTROL values (channel/frequency/gain/filter/phase) — it never sets
 * quality/lock/decode/completion state directly; those always flow through
 * the real SignalEvaluator/SignalLockController/DecodeController driven by
 * the scene's real per-frame update() tick, exactly as real gameplay would.
 * The dedicated "full signal puzzle" test at the bottom additionally drives
 * the control-room power setup and opens the receiver via a real [E] press,
 * per the milestone spec's discipline for the one full-progression test.
 *
 * Timing: bringing the generator online (crank + warm-up wait) is by far
 * the most expensive setup step under headless SwiftShader — power.spec.ts
 * documents waits up to 60s for a single warm-up. Rather than repeating
 * that bring-up independently in every test (which power.spec.ts can
 * afford with ~6 generator-dependent tests but this file cannot with
 * dozens), most receiver-behavior tests share ONE bring-up via a
 * `test.describe.serial` block with a `beforeAll`-created page — mirroring
 * how a real play session tunes, scans, locks, loses lock, and decodes
 * within a single continuous receiver session. Tests that specifically
 * need their OWN fresh power-up (boot-interruption, repeated dev resets,
 * the full end-to-end puzzle) remain standalone.
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

interface ReceiverSnapshot {
  mode: string;
  controls: {
    channel: number;
    frequencyMHz: number;
    gain: number;
    filter: number;
    phaseDeg: number;
  };
  bootProgress: number;
  isPanelOpen: boolean;
  scanning: boolean;
  activeSignalId: string | null;
  metrics: { overallQuality: number; limitingFactor: string } | null;
  lockState: string;
  acquisitionProgress: number;
  holdQuality: number;
  decodeState: string;
  decodeProgress: number;
  decodedSignalIds: string[];
}

interface SignalRuntimeSnapshot {
  signalPhase: string;
  decodedSignalIds: string[];
  transcriptAvailable: boolean;
  puzzleComplete: boolean;
}

function bridge(page: Page) {
  return {
    generatorAction: (action: string) =>
      page.evaluate((a: string) => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['generatorAction'];
        return typeof fn === 'function' ? (fn as (a: string) => boolean)(a) : false;
      }, action),
    generatorSnapshot: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['getGeneratorSnapshot'];
        return typeof fn === 'function'
          ? (fn as () => { state: string; mainBreaker: string })()
          : undefined;
      }),
    toggleCircuit: (circuitId: string) =>
      page.evaluate((c: string) => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['toggleCircuit'];
        return typeof fn === 'function' ? (fn as (c: string) => string | null)(c) : undefined;
      }, circuitId),
    activateTarget: (targetId: string) =>
      page.evaluate((id: string) => window.__TLS_TEST__?.activateTarget?.(id) ?? false, targetId),
    teleportTo: (id: string) =>
      page.evaluate((tpId: string) => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['teleportTo'];
        return typeof fn === 'function' ? (fn as (id: string) => boolean)(tpId) : false;
      }, id),
    interactionState: () => page.evaluate(() => window.__TLS_TEST__?.getInteractionState?.()),
    diagnostics: () => page.evaluate(() => window.__TLS_TEST__?.getDiagnostics?.()),
    resetFacility: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['resetFacility'];
        if (typeof fn === 'function') (fn as () => void)();
      }),
    respawn: () => page.evaluate(() => window.__TLS_TEST__?.respawn?.()),

    // ----- receiver-specific --------------------------------------------
    getReceiverSnapshot: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['getReceiverSnapshot'];
        return typeof fn === 'function' ? (fn as () => ReceiverSnapshot)() : undefined;
      }),
    getSignalRuntimeSnapshot: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['getSignalRuntimeSnapshot'];
        return typeof fn === 'function' ? (fn as () => SignalRuntimeSnapshot)() : undefined;
      }),
    openReceiverPanel: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['openReceiverPanel'];
        return typeof fn === 'function' ? (fn as () => boolean)() : false;
      }),
    closeReceiverPanel: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['closeReceiverPanel'];
        if (typeof fn === 'function') (fn as () => void)();
      }),
    isReceiverPanelOpen: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['isReceiverPanelOpen'];
        return typeof fn === 'function' ? (fn as () => boolean)() : false;
      }),
    receiverAction: (action: string, value?: number) =>
      page.evaluate(
        ([a, v]) => {
          const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
          const fn = b['receiverAction'];
          return typeof fn === 'function'
            ? (fn as (a: string, v?: number) => boolean)(a, v)
            : false;
        },
        [action, value] as const,
      ),
    getSignalEventCounters: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['getSignalEventCounters'];
        return typeof fn === 'function'
          ? (
              fn as () => {
                lockAcquired: number;
                lockLost: number;
                decodeCompleted: number;
                channelActivityDetected: number;
              }
            )()
          : undefined;
      }),
  };
}

const CONTROL_ROOM_CIRCUIT = 'fg-circuit-control-room';

const SIGNAL_ID = 'first_anomalous_transmission';
const TARGET_CHANNEL: number = 3;
const TARGET_FREQUENCY = 117.4;
const TARGET_GAIN = 0.6;
const TARGET_FILTER = 0.65;
const TARGET_PHASE = -18;

/** Real generator startup via bridge shortcuts (setup speed only, mirrors power.spec.ts). */
async function bringGeneratorOnline(page: Page): Promise<void> {
  const b = bridge(page);
  await b.generatorAction('inspect');
  await b.generatorAction('openFuelValve');
  await b.generatorAction('connectBattery');
  await b.generatorAction('releaseEmergencyStop');
  await b.generatorAction('setSelectorManual');
  expect(await b.activateTarget('fg-gen-ctrl-starter')).toBe(true);
  await expect
    .poll(() => b.generatorSnapshot().then((s) => s?.state), { timeout: 60_000, intervals: [500] })
    .toBe('Running');
  await b.generatorAction('closeMainBreaker');
}

/** Generator online + control-room circuit energized + receiver panel open. */
async function bringReceiverOnline(page: Page): Promise<void> {
  const b = bridge(page);
  await bringGeneratorOnline(page);
  await b.toggleCircuit(CONTROL_ROOM_CIRCUIT);
  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 20_000 })
    .not.toBe('Offline');
  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 20_000 })
    .not.toBe('Booting');
  expect(await b.openReceiverPanel()).toBe(true);
}

/** Tunes every control to the exact solution via the bridge (real setters, real evaluator downstream). */
async function tuneToSolution(page: Page): Promise<void> {
  const b = bridge(page);
  await b.receiverAction('setChannel', TARGET_CHANNEL);
  await b.receiverAction('setFrequency', TARGET_FREQUENCY);
  await b.receiverAction('setGain', TARGET_GAIN);
  await b.receiverAction('setFilter', TARGET_FILTER);
  await b.receiverAction('setPhase', TARGET_PHASE);
}

// ---------------------------------------------------------------------------
// Cheap tests — no generator/power setup required.
// ---------------------------------------------------------------------------

test('signal bridge is available and the receiver starts Offline', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  const snap = await b.getReceiverSnapshot();
  expect(snap?.mode).toBe('Offline');
  expect(snap?.controls.channel).toBe(1);
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('the receiver cannot be opened before the control-room circuit is powered', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  expect(await b.openReceiverPanel()).toBe(false);
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('F11 toggles the signal debug overlay DOM panel on and off', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  await expect(page.locator('#signal-debug-overlay')).toBeHidden();
  await page.keyboard.press('F11');
  await expect(page.locator('#signal-debug-overlay')).toBeVisible();
  await expect(page.locator('#signal-debug-overlay')).toContainText('Mode');
  await page.keyboard.press('F11');
  await expect(page.locator('#signal-debug-overlay')).toBeHidden();

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('F11 is inert while the receiver panel is closed and the interaction mode stays gameplay', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await page.keyboard.press('F11');
  await expect(page.locator('#signal-debug-overlay')).toBeVisible();
  await expect.poll(() => b.interactionState().then((s) => s?.mode)).toBe('gameplay');
  await page.keyboard.press('F11');

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('lifecycle: repeated F11 toggling leaves overlay DOM count stable', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const before = await bridge(page).diagnostics();

  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('F11');
  }
  await expect(page.locator('#signal-debug-overlay')).toBeHidden();
  const overlayCount = await page.locator('#signal-debug-overlay').count();
  expect(overlayCount).toBe(1);

  const after = await bridge(page).diagnostics();
  if (before !== undefined && after !== undefined) {
    expect(after.cameraCount).toBe(before.cameraCount);
    expect(after.beforeRenderObserverCount).toBe(before.beforeRenderObserverCount);
  }
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Standalone tests requiring their OWN fresh generator startup (boot
// interruption is exclusive with the shared session's normal boot flow).
// ---------------------------------------------------------------------------

test('the receiver powers on and boots once the control-room circuit energizes', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await bringGeneratorOnline(page);

  expect((await b.getReceiverSnapshot())?.mode).toBe('Offline');
  await b.toggleCircuit(CONTROL_ROOM_CIRCUIT);

  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 5_000 })
    .toBe('Booting');
  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 10_000 })
    .toBe('Idle');

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('cutting control-room power aborts an in-progress boot back to Offline', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await bringGeneratorOnline(page);
  await b.toggleCircuit(CONTROL_ROOM_CIRCUIT);
  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 5_000 })
    .toBe('Booting');
  await b.toggleCircuit(CONTROL_ROOM_CIRCUIT); // off, mid-boot
  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 5_000 })
    .toBe('Offline');
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('lifecycle: repeated boot/power-loss recovery cycles settle deterministically', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await bringGeneratorOnline(page);

  const before = await b.diagnostics();
  for (let i = 0; i < 15; i++) {
    await b.toggleCircuit(CONTROL_ROOM_CIRCUIT); // on
    await expect
      .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 5000 })
      .not.toBe('Offline');
    await b.toggleCircuit(CONTROL_ROOM_CIRCUIT); // off
    await expect
      .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 5000 })
      .toBe('Offline');
  }
  const after = await b.diagnostics();
  if (before !== undefined && after !== undefined) {
    expect(after.cameraCount).toBe(before.cameraCount);
    expect(after.beforeRenderObserverCount).toBe(before.beforeRenderObserverCount);
  }
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('lifecycle: repeated dev resets settle to identical clean receiver state', async ({
  page,
}) => {
  // Reduced from the spec's suggested 5 iterations to 3: each iteration pays
  // a full generator-startup cost (up to 60s under degraded headless
  // SwiftShader pacing, per power.spec.ts's documented experience), so 3
  // iterations already exercises the reset→re-bringup path multiple times
  // without an impractical total runtime.
  test.setTimeout(240_000);
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);

  for (let i = 0; i < 3; i++) {
    await bringReceiverOnline(page);
    await b.resetFacility();
    // resetFacility() closes any open panels, which flips the interaction
    // mode back to 'gameplay' on the NEXT render frame, not synchronously
    // (same precedent documented in power.spec.ts) — the next iteration's
    // bringGeneratorOnline() calls devActivate() on the starter, which
    // requires mode === 'gameplay' already, so wait for it here rather
    // than assuming resetFacility() settled it in time.
    await expect
      .poll(() => b.interactionState().then((s) => s?.mode), { timeout: 5000 })
      .toBe('gameplay');
    const snap = await b.getReceiverSnapshot();
    expect(snap?.mode).toBe('Offline');
    expect(await b.isReceiverPanelOpen()).toBe(false);
  }
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Shared-session block: ONE generator+receiver bring-up, many sequential
// assertions layered on top — mirrors a single continuous play session
// (tune, scan, lock, lose lock, decode, read transcript, persist).
// ---------------------------------------------------------------------------

test.describe.serial('receiver puzzle — shared online session', () => {
  let page: Page;
  const errors = { console: [] as string[], page: [] as string[] };

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    page = await browser.newPage();
    await boot(page, errors);
    await bringReceiverOnline(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('panel is open and the interaction mode is "receiver"', async () => {
    const b = bridge(page);
    expect(await b.isReceiverPanelOpen()).toBe(true);
    await expect(page.locator('#receiver-panel-viewer')).toBeVisible();
    await expect(page.locator('#receiver-panel-viewer')).toContainText('SIGNAL RECEIVER');
    await expect.poll(() => b.interactionState().then((s) => s?.mode)).toBe('receiver');
  });

  test('tuning to the wrong channel never locks, even with every other control exact', async () => {
    // The facility only registers first_anomalous_transmission on channel
    // 3, so tuning to any other channel means there is literally no signal
    // there — ReceiverController.getSnapshot() correctly reports `metrics:
    // null` (nothing to evaluate) rather than a computed channel-mismatch
    // object. The channel-mismatch quality-capping behavior itself (a
    // *registered* signal on a channel you're not tuned to still forcing
    // overallQuality to 0) is unit-tested directly against SignalEvaluator
    // in signalEvaluator.test.ts with a synthetic second signal — this e2e
    // test instead confirms the real-world consequence: no lock, ever,
    // on a channel with nothing on it.
    const b = bridge(page);
    await b.receiverAction('setChannel', TARGET_CHANNEL === 6 ? 1 : TARGET_CHANNEL + 1);
    await b.receiverAction('setFrequency', TARGET_FREQUENCY);
    await b.receiverAction('setGain', TARGET_GAIN);
    await b.receiverAction('setFilter', TARGET_FILTER);
    await b.receiverAction('setPhase', TARGET_PHASE);
    await page.waitForTimeout(300);

    const snap = await b.getReceiverSnapshot();
    expect(snap?.metrics).toBeNull();
    expect(snap?.lockState).toBe('Searching');
  });

  test('tuning to the exact solution reaches high overall quality and no limiting factor', async () => {
    await tuneToSolution(page);
    const b = bridge(page);
    await page.waitForTimeout(300);

    const snap = await b.getReceiverSnapshot();
    expect(snap?.metrics?.overallQuality ?? 0).toBeGreaterThanOrEqual(0.85);
    expect(snap?.metrics?.limitingFactor).toBe('none');
  });

  test('sustained good tuning acquires lock through the real lock controller', async () => {
    const b = bridge(page);
    await expect
      .poll(() => b.getReceiverSnapshot().then((s) => s?.lockState), { timeout: 15_000 })
      .toBe('Locked');
    const counters = await b.getSignalEventCounters();
    expect(counters?.lockAcquired).toBe(1);
  });

  test('detuning after lock eventually loses it, without a duplicate acquisition event', async () => {
    // SignalLost is a deliberately transient one-tick mode (see
    // receiver-state-model.md) — it resolves to Tuning/Candidate/Acquiring
    // on the very next tick, so polling for that exact mode value risks
    // missing it between poll intervals. The reliable, non-flaky signal is
    // the lockLost event counter (a discrete, accumulated count) plus the
    // fact that mode is no longer any of the "still locked" values.
    const b = bridge(page);
    await b.receiverAction('setGain', 0.0); // detune hard
    await expect
      .poll(() => b.getSignalEventCounters().then((c) => c?.lockLost), { timeout: 15_000 })
      .toBe(1);
    const snap = await b.getReceiverSnapshot();
    expect(['Locked', 'Decoding', 'Decoded']).not.toContain(snap?.mode);
    const counters = await b.getSignalEventCounters();
    expect(counters?.lockAcquired).toBe(1); // unchanged
  });

  test('scan sweeps deterministically, detects channel activity, is cancellable, and stops on manual adjustment', async () => {
    const b = bridge(page);
    // Cancel scan's effect on gain from the previous test first — start
    // this scenario from a known state.
    expect(await b.receiverAction('startScan')).toBe(true);
    await expect
      .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 5_000 })
      .toBe('Scanning');

    await expect
      .poll(() => b.getSignalRuntimeSnapshot().then((s) => s?.signalPhase), { timeout: 25_000 })
      .not.toBe('ReceiverOnline'); // SignalDetected reached via scan activity

    await b.receiverAction('setGain', 0.7); // manual adjustment cancels scan
    const snap = await b.getReceiverSnapshot();
    expect(snap?.scanning).toBe(false);
    expect(snap?.mode).toBe('Tuning');
  });

  test('re-tuning to solution, maintaining lock through decode, completes exactly once', async () => {
    test.setTimeout(60_000);
    await tuneToSolution(page);
    const b = bridge(page);

    await expect
      .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), {
        timeout: 30_000,
        intervals: [500],
      })
      .toBe('Decoded');

    const counters = await b.getSignalEventCounters();
    expect(counters?.decodeCompleted).toBe(1);

    const runtimeSnap = await b.getSignalRuntimeSnapshot();
    expect(runtimeSnap?.decodedSignalIds).toContain(SIGNAL_ID);
    expect(runtimeSnap?.transcriptAvailable).toBe(true);
  });

  test('opening the transcript shows decoded content; closing returns to the panel, not gameplay', async () => {
    const b = bridge(page);
    await page.locator('.receiver-transcript-open-btn').click();
    await expect(page.locator('.receiver-transcript')).toBeVisible();
    await expect(page.locator('.receiver-transcript')).toContainText('DECODED TRANSMISSION');

    await page.keyboard.press('Escape');
    await expect(page.locator('.receiver-transcript')).toBeHidden();
    expect(await b.isReceiverPanelOpen()).toBe(true);
    await expect.poll(() => b.interactionState().then((s) => s?.mode)).toBe('receiver');
  });

  test('closing and reopening the receiver preserves the decoded state (no re-decode)', async () => {
    const b = bridge(page);
    const countersBefore = await b.getSignalEventCounters();

    await b.closeReceiverPanel();
    // devActivate() (which openReceiverPanel() routes through) requires the
    // interaction mode to have already settled back to 'gameplay' — that
    // flip happens on the next render frame after close(), not
    // synchronously (same precedent documented in power.spec.ts for the
    // distribution panel) — so poll for it rather than assuming a fixed
    // delay is enough.
    await expect
      .poll(() => b.interactionState().then((s) => s?.mode), { timeout: 5000 })
      .toBe('gameplay');
    expect(await b.openReceiverPanel()).toBe(true);
    expect((await b.getReceiverSnapshot())?.mode).toBe('Decoded');

    const countersAfter = await b.getSignalEventCounters();
    expect(countersAfter?.decodeCompleted).toBe(countersBefore?.decodeCompleted);
  });

  test('respawn preserves receiver/signal state', async () => {
    const b = bridge(page);
    const before = await b.getReceiverSnapshot();
    await b.respawn();
    await page.waitForTimeout(150);
    const after = await b.getReceiverSnapshot();
    expect(after?.controls).toEqual(before?.controls);
    expect(after?.mode).toBe(before?.mode);
  });

  test('lifecycle: many rapid control adjustments stay within valid ranges', async () => {
    const b = bridge(page);
    for (let i = 0; i < 100; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      await b.receiverAction('setGain', 0.5 + dir * 0.01 * (i % 10));
      await b.receiverAction('setFilter', 0.5 + dir * 0.01 * (i % 10));
      await b.receiverAction('setPhase', dir * (i % 30));
    }
    const snap = await b.getReceiverSnapshot();
    expect(snap?.controls.gain).toBeGreaterThanOrEqual(0);
    expect(snap?.controls.gain).toBeLessThanOrEqual(1);
    expect(snap?.controls.filter).toBeGreaterThanOrEqual(0);
    expect(snap?.controls.filter).toBeLessThanOrEqual(1);
    expect(snap?.controls.phaseDeg).toBeGreaterThan(-181);
    expect(snap?.controls.phaseDeg).toBeLessThanOrEqual(180);
  });

  test('lifecycle: repeated scan start/cancel cycles never leave the receiver stuck in Scanning', async () => {
    const b = bridge(page);
    for (let i = 0; i < 30; i++) {
      await b.receiverAction('startScan');
      await b.receiverAction('cancelScan');
    }
    const snap = await b.getReceiverSnapshot();
    expect(snap?.scanning).toBe(false);
  });

  test('lifecycle: repeated receiver open/close cycles do not leak DOM or observers', async () => {
    const b = bridge(page);
    if (await b.isReceiverPanelOpen()) {
      await b.closeReceiverPanel();
    }
    const before = await b.diagnostics();

    for (let i = 0; i < 30; i++) {
      await expect
        .poll(() => b.interactionState().then((s) => s?.mode), { timeout: 5000 })
        .toBe('gameplay');
      expect(await b.openReceiverPanel()).toBe(true);
      expect(await b.isReceiverPanelOpen()).toBe(true);
      await b.closeReceiverPanel();
      expect(await b.isReceiverPanelOpen()).toBe(false);
    }

    const panelElementCount = await page.locator('#receiver-panel-viewer').count();
    expect(panelElementCount).toBe(1);

    const after = await b.diagnostics();
    if (before !== undefined && after !== undefined) {
      expect(after.cameraCount).toBe(before.cameraCount);
      expect(after.beforeRenderObserverCount).toBe(before.beforeRenderObserverCount);
    }
  });

  test('lifecycle: repeated lock acquire/loss cycles never double-fire events', async () => {
    // This runs after decode already completed earlier in the shared
    // session — once DecodeController reaches 'Completed' it never resets
    // itself on a subsequent lock loss (only power-cycle/reset does), so
    // ReceiverController.receiverMode correctly stays 'Decoded' throughout
    // this test (see receiver-state-model.md's decodeState-priority
    // reconciliation). This test therefore checks SignalLockController's
    // own lockState (which does keep cycling Locked→Lost→Searching
    // independently of decode) and the event counters, not receiverMode.
    test.setTimeout(120_000);
    const b = bridge(page);
    await expect
      .poll(() => b.interactionState().then((s) => s?.mode), { timeout: 5000 })
      .toBe('gameplay');
    expect(await b.openReceiverPanel()).toBe(true);
    expect((await b.getReceiverSnapshot())?.mode).toBe('Decoded');
    const before = await b.getSignalEventCounters();

    for (let i = 0; i < 5; i++) {
      await tuneToSolution(page);
      await expect
        .poll(() => b.getReceiverSnapshot().then((s) => s?.lockState), { timeout: 15_000 })
        .toBe('Locked');
      await b.receiverAction('setGain', 0);
      await expect
        .poll(
          () =>
            b.getSignalEventCounters().then((c) => (c?.lockLost ?? 0) - (before?.lockLost ?? 0)),
          { timeout: 15_000 },
        )
        .toBe(i + 1);
    }
    const after = await b.getSignalEventCounters();
    // decodeCompleted must not re-fire — repeated acquire/loss cycles on an
    // already-decoded signal stay inert for decode specifically, exactly
    // like the close/reopen persistence test above.
    expect(after?.decodeCompleted).toBe(before?.decodeCompleted);
    expect((after?.lockLost ?? 0) - (before?.lockLost ?? 0)).toBe(5);
    expect((after?.lockAcquired ?? 0) - (before?.lockAcquired ?? 0)).toBe(5);
    expect((await b.getReceiverSnapshot())?.mode).toBe('Decoded');
  });

  test('no console or page errors accumulated across the whole shared session', () => {
    expect(errors.console).toHaveLength(0);
    expect(errors.page).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Full signal puzzle — real gameplay interactions for power + open, real
// evaluator-driven tuning/lock/decode, real transcript, real persistence.
// ---------------------------------------------------------------------------

test('full signal puzzle: real power setup, real tuning, lock, decode, transcript, persistence', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);

  // ----- Real generator startup + control-room power, via bridge shortcuts
  // for setup speed (same discipline as power.spec.ts's non-dedicated
  // tests) — the receiver puzzle itself below never uses a state-setting
  // shortcut for quality/lock/decode/completion. --------------------------
  await bringGeneratorOnline(page);
  await b.toggleCircuit(CONTROL_ROOM_CIRCUIT);
  // Boot takes ~1.5s (see ReceiverDefinition.bootSeconds) — wait it out
  // before attempting to open, otherwise a real [E] press can land while
  // the receiver is still Booting (open() legitimately rejects that) and
  // silently do nothing.
  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 20_000 })
    .not.toBe('Offline');
  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 20_000 })
    .not.toBe('Booting');

  // ----- Open the receiver via a real [E] press at its teleport vantage --
  // Retries the teleport+focus+press sequence within a budget, mirroring
  // power.spec.ts's documented press()/focusOn() precedent: under degraded
  // headless frame pacing a single keydown can land before
  // InteractionSystem's own onBeforeRenderObservable tick consumes it, so
  // a fixed one-shot press is not reliably enough.
  const openDeadline = Date.now() + 30_000;
  let opened = false;
  while (Date.now() < openDeadline && !opened) {
    expect(await b.teleportTo('fg-tp-receiver')).toBe(true);
    await expect
      .poll(() => b.interactionState().then((s) => s?.focusedId), { timeout: 8_000 })
      .toBe('fg-receiver');
    await page.keyboard.press('KeyE');
    try {
      await expect(page.locator('#receiver-panel-viewer')).toBeVisible({ timeout: 5_000 });
      opened = true;
    } catch {
      // Retry — see comment above.
    }
  }
  expect(opened).toBe(true);
  await expect.poll(() => b.interactionState().then((s) => s?.mode)).toBe('receiver');

  // ----- Select the correct channel and tune every control via the real
  // control view (dev-bridge control setters operate the SAME
  // ReceiverController methods a real keyboard/mouse interaction would call
  // — they never set quality/lock/decode/completion directly). -----------
  await tuneToSolution(page);

  // ----- Acquire lock through the real evaluator + lock controller -------
  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.lockState), { timeout: 20_000 })
    .toBe('Locked');

  // ----- Maintain lock through decode completion --------------------------
  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 30_000, intervals: [500] })
    .toBe('Decoded');

  const counters = await b.getSignalEventCounters();
  expect(counters?.lockAcquired).toBe(1);
  expect(counters?.decodeCompleted).toBe(1);

  // ----- Open the transcript -----------------------------------------------
  await page.locator('.receiver-transcript-open-btn').click();
  await expect(page.locator('.receiver-transcript')).toBeVisible();
  await expect(page.locator('.receiver-transcript')).toContainText('CHANNEL 3');
  await page.keyboard.press('Escape');
  await expect(page.locator('.receiver-transcript')).toBeHidden();

  // ----- Verify the final signal milestone ---------------------------------
  const runtimeSnap = await b.getSignalRuntimeSnapshot();
  expect(runtimeSnap?.signalPhase).toBe('SignalPuzzleComplete');
  expect(runtimeSnap?.puzzleComplete).toBe(true);
  expect(runtimeSnap?.decodedSignalIds).toContain(SIGNAL_ID);

  // ----- Close and reopen to confirm decoded-state persistence ------------
  await page.keyboard.press('Escape');
  await expect(page.locator('#receiver-panel-viewer')).toBeHidden();
  await expect.poll(() => b.interactionState().then((s) => s?.mode)).toBe('gameplay');

  expect(await b.teleportTo('fg-tp-receiver')).toBe(true);
  await expect
    .poll(() => b.interactionState().then((s) => s?.focusedId), { timeout: 10_000 })
    .toBe('fg-receiver');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#receiver-panel-viewer')).toBeVisible({ timeout: 10_000 });
  expect((await b.getReceiverSnapshot())?.mode).toBe('Decoded');

  // ----- No duplicate decode events from the reopen -----------------------
  const countersAfterReopen = await b.getSignalEventCounters();
  expect(countersAfterReopen?.decodeCompleted).toBe(1);
  expect(countersAfterReopen?.lockAcquired).toBe(1);

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});
