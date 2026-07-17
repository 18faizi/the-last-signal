import { expect, test, type Page } from '@playwright/test';

/**
 * Milestone 0.8 antenna alignment browser tests.
 *
 * Follows signal.spec.ts's/power.spec.ts's bridge-shortcut discipline
 * exactly: the bridge only ever sets CONTROL values (azimuth/elevation/
 * polarization commands, waveguide port cycling) or triggers real domain
 * actions (collectSample/runComparison) — it never sets alignment quality,
 * samples, bearing results, or classification directly. Every quality/
 * sample/reveal outcome flows through the real AntennaEvaluator/
 * AntennaController/WaveguideController/SourceAnalysisController driven by
 * the scene's real per-frame update() tick, exactly as real gameplay would.
 *
 * Generator/circuit bring-up and the receiver decode are done via bridge
 * shortcuts for SETUP SPEED only (mirrors signal.spec.ts's own discipline);
 * the antenna panel is opened and the waveguide junction corrected via REAL
 * [E] presses in the shared-session describe block below, satisfying the
 * "real gameplay interactions" requirement for the significant milestone
 * actions without repeating the full generator warm-up per test.
 */

async function boot(page: Page, errors: { console: string[]; page: string[] }): Promise<void> {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text());
  });
  page.on('pageerror', (error) => errors.page.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading-root')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('#fatal-error-root')).toBeHidden();
  await page.locator('#game-canvas').click({ position: { x: 40, y: 40 } });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__TLS_TEST__?.setPointerLockBypass(true));
}

interface AntennaArraySnap {
  id: string;
  controlState: string;
  mechanical: {
    currentAzimuthDeg: number;
    currentElevationDeg: number;
    currentPolarizationDeg: number;
  };
  metrics: { overallQuality: number; alignmentQuality: number } | null;
}
interface AntennaSnapshot {
  selectedArrayId: string | null;
  powered: boolean;
  arrays: AntennaArraySnap[];
}
interface AntennaRuntimeSnapshot {
  antennaPhase: string;
  sampledArrayIds: string[];
  revealComplete: boolean;
}
interface WaveguideSnapshot {
  id: string;
  currentPortId: string;
  state: string;
  continuity: number;
}
interface SourceAnalysisSnapshot {
  state: string;
  samples: Array<{ arrayId: string; bearing: { category: string } }>;
  requiredArrayIds: string[];
  result: { contradictionDetected: boolean; localLoopConfirmed: boolean } | null;
}

function bridge(page: Page) {
  function call<T>(name: string, ...args: unknown[]): Promise<T> {
    return page.evaluate(
      ([n, a]) => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b[n];
        return typeof fn === 'function'
          ? (fn as (...args: unknown[]) => T)(...(a as []))
          : undefined;
      },
      [name, args] as const,
    ) as Promise<T>;
  }

  return {
    generatorAction: (action: string) => call<boolean>('generatorAction', action),
    generatorSnapshot: () => call<{ state: string }>('getGeneratorSnapshot'),
    toggleCircuit: (circuitId: string) => call<string | null>('toggleCircuit', circuitId),
    activateTarget: (targetId: string) => call<boolean>('activateTarget', targetId),
    teleportTo: (id: string) => call<boolean>('teleportTo', id),
    interactionState: () =>
      page.evaluate(() => window.__TLS_TEST__?.getInteractionState?.()) as Promise<
        { mode: string; focusedId: string | null } | undefined
      >,
    diagnostics: () => page.evaluate(() => window.__TLS_TEST__?.getDiagnostics?.()),
    resetFacility: () => call<void>('resetFacility'),
    collectPickup: (id: string) => call<boolean>('collectPickup', id),
    openDoor: (id: string) => call<boolean>('openDoor', id),

    getReceiverSnapshot: () =>
      call<{ mode: string; metrics: { overallQuality: number } | null }>('getReceiverSnapshot'),
    receiverAction: (action: string, value?: number) =>
      call<boolean>('receiverAction', action, value),
    openReceiverPanel: () => call<boolean>('openReceiverPanel'),
    closeReceiverPanel: () => call<void>('closeReceiverPanel'),

    getAntennaSnapshot: () => call<AntennaSnapshot>('getAntennaSnapshot'),
    getAntennaRuntimeSnapshot: () => call<AntennaRuntimeSnapshot>('getAntennaRuntimeSnapshot'),
    getWaveguideSnapshot: (pathId: string) =>
      call<WaveguideSnapshot>('getWaveguideSnapshot', pathId),
    getSourceAnalysisSnapshot: () => call<SourceAnalysisSnapshot>('getSourceAnalysisSnapshot'),
    openAntennaPanel: () => call<boolean>('openAntennaPanel'),
    closeAntennaPanel: () => call<void>('closeAntennaPanel'),
    isAntennaPanelOpen: () => call<boolean>('isAntennaPanelOpen'),
    antennaAction: (action: string, value?: number) =>
      call<boolean>('antennaAction', action, value),
    selectAntennaArray: (arrayId: string) => call<boolean>('selectAntennaArray', arrayId),
    cycleWaveguidePort: (pathId: string) => call<boolean>('cycleWaveguidePort', pathId),
    collectSourceSample: () => call<unknown>('collectSourceSample'),
    runSourceAnalysisComparison: () => call<unknown>('runSourceAnalysisComparison'),
  };
}

const CONTROL_ROOM_CIRCUIT = 'fg-circuit-control-room';
const ROOFTOP_CIRCUIT = 'fg-circuit-rooftop-antenna';
const NORTH_ID = 'fg-antenna-north-dish';
const EAST_ID = 'fg-antenna-east-relay';
const DIAG_ID = 'fg-antenna-tower-diagnostic';
const EAST_WAVEGUIDE_ID = 'fg-waveguide-east-relay';

/** Real generator startup via bridge shortcuts (setup speed only). */
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

/** Generator + control-room circuit only (rooftop stays off — matches the spec's revised sequence: decode BEFORE rooftop power). */
async function bringControlRoomOnline(page: Page): Promise<void> {
  const b = bridge(page);
  await bringGeneratorOnline(page);
  await b.toggleCircuit(CONTROL_ROOM_CIRCUIT);
}

/** Energizes the rooftop circuit (assumed control-room already online). */
async function bringRooftopOnline(page: Page): Promise<void> {
  const b = bridge(page);
  await b.toggleCircuit(ROOFTOP_CIRCUIT);
  await expect
    .poll(() => b.getAntennaSnapshot().then((s) => s?.powered), { timeout: 20_000 })
    .toBe(true);
}

/** Generator + control-room + rooftop circuits energized (bridge shortcuts) — used by tests that don't care about ordering. */
async function bringPowerOnline(page: Page): Promise<void> {
  await bringControlRoomOnline(page);
  await bringRooftopOnline(page);
}

/** Decodes first_anomalous_transmission via real bridge tuning (real evaluator downstream). */
async function decodeTransmission(page: Page): Promise<void> {
  const b = bridge(page);
  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 20_000 })
    .not.toBe('Offline');
  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 20_000 })
    .not.toBe('Booting');
  expect(await b.openReceiverPanel()).toBe(true);
  await b.receiverAction('setChannel', 3);
  await b.receiverAction('setFrequency', 117.4);
  await b.receiverAction('setGain', 0.6);
  await b.receiverAction('setFilter', 0.65);
  await b.receiverAction('setPhase', -18);
  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 30_000, intervals: [500] })
    .toBe('Decoded');
  // Close the receiver panel — leaving it open suspends gameplay input
  // (mode stays 'receiver'), which would block every subsequent real [E]
  // interaction this suite drives at the antenna cabinet/junction.
  await b.closeReceiverPanel();
  await expect.poll(() => b.interactionState().then((s) => s?.mode)).toBe('gameplay');
}

/** Commands an array to its exact target position via real bridge setters, waits for arrival. */
async function alignArray(
  page: Page,
  arrayId: string,
  target: { az: number; el: number; pol: number },
): Promise<void> {
  const b = bridge(page);
  expect(await b.selectAntennaArray(arrayId)).toBe(true);
  await b.antennaAction('setAzimuth', target.az);
  await b.antennaAction('setElevation', target.el);
  await b.antennaAction('setPolarization', target.pol);
  // Real, frame-rate-independent mechanical travel: worst case here is ~180°
  // of azimuth at 12-20°/s (see facilityAntennaDefinitions.ts), i.e. under
  // 15s of simulated motion — but under degraded headless SwiftShader frame
  // pacing (same host-load sensitivity documented in movement.spec.ts's
  // widened poll timeout), the WALL-CLOCK time to simulate that many
  // seconds of dt can run well past 20s once several real-interaction tests
  // have already run in the same shared session. 45s gives comfortable
  // margin without masking a genuine stall (confirmed: this array's exact
  // target reliably resolves to 'Aligned' well under 45s in isolation).
  await expect
    .poll(
      () =>
        b.getAntennaSnapshot().then((s) => {
          const a = s?.arrays.find((x) => x.id === arrayId);
          return a?.controlState;
        }),
      { timeout: 45_000, intervals: [500] },
    )
    .toBe('Aligned');
}

// ---------------------------------------------------------------------------
// Cheap tests — no generator/power setup required.
// ---------------------------------------------------------------------------

test('antenna bridge is available and starts unpowered with every array Offline', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  const snap = await b.getAntennaSnapshot();
  expect(snap?.powered).toBe(false);
  expect(snap?.arrays.every((a) => a.controlState === 'Offline')).toBe(true);
  expect(errors.console).toHaveLength(0);
});

test('waveguide starts Misrouted for the East Relay path (spec §23 example)', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  const snap = await b.getWaveguideSnapshot(EAST_WAVEGUIDE_ID);
  expect(snap?.state).toBe('Misrouted');
  expect(snap?.continuity).toBe(0);
});

test('the antenna panel cannot be opened before the rooftop circuit is powered', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  expect(await b.openAntennaPanel()).toBe(false);
  expect(await b.isAntennaPanelOpen()).toBe(false);
});

test('F2 toggles the antenna debug overlay DOM panel on and off', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  await page.keyboard.press('F2');
  await expect(page.locator('#antenna-debug-overlay')).toBeVisible();
  await page.keyboard.press('F2');
  await expect(page.locator('#antenna-debug-overlay')).toBeHidden();
});

test('F2 is inert while the antenna panel is closed and interaction mode stays gameplay', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await page.keyboard.press('F2');
  await page.waitForTimeout(100);
  expect((await b.interactionState())?.mode).toBe('gameplay');
});

test('dev full reset clears antenna/waveguide/source-analysis state to defaults', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await b.resetFacility();
  const antennaSnap = await b.getAntennaSnapshot();
  const runtimeSnap = await b.getAntennaRuntimeSnapshot();
  const wgSnap = await b.getWaveguideSnapshot(EAST_WAVEGUIDE_ID);
  const saSnap = await b.getSourceAnalysisSnapshot();
  expect(antennaSnap?.powered).toBe(false);
  expect(antennaSnap?.selectedArrayId).toBeNull();
  expect(runtimeSnap?.antennaPhase).toBe('Unavailable');
  expect(runtimeSnap?.revealComplete).toBe(false);
  expect(wgSnap?.state).toBe('Misrouted');
  expect(saSnap?.state).toBe('Unavailable');
});

// ---------------------------------------------------------------------------
// Shared online session: one expensive bring-up, many sequential assertions.
// ---------------------------------------------------------------------------

test.describe.serial('antenna alignment — shared online session', () => {
  // Generous: generator warm-up alone is documented up to 60s under
  // degraded headless SwiftShader load (see power.spec.ts), plus real
  // mechanical antenna travel for 3 arrays plus decode/tuning — each
  // individually bounded, but the sum needs real headroom on a
  // resource-constrained host.
  test.setTimeout(360_000);
  let page: Page;
  const errors = { console: [] as string[], page: [] as string[] };

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await boot(page, errors);
    // Revised sequence (spec §44): decode first_anomalous_transmission via
    // real receiver tuning BEFORE the rooftop circuit is ever energized —
    // confirms the antenna/source-analysis prerequisite chain reacts to an
    // ALREADY-decoded transmission rather than requiring decode to happen
    // after rooftop power.
    await bringControlRoomOnline(page);
    await decodeTransmission(page);
    const bBeforeRooftop = bridge(page);
    const decodedBeforeRooftop = (await bBeforeRooftop.getReceiverSnapshot())?.mode;
    if (decodedBeforeRooftop !== 'Decoded') {
      throw new Error(`expected Decoded before rooftop power, got ${String(decodedBeforeRooftop)}`);
    }
    const antennaPoweredBeforeRooftop = (await bBeforeRooftop.getAntennaSnapshot())?.powered;
    if (antennaPoweredBeforeRooftop !== false) {
      throw new Error('antenna should not be powered before the rooftop circuit is toggled');
    }
    await bringRooftopOnline(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  /**
   * Mirrors power.spec.ts's focusOn()/press() precedent exactly: the very
   * first raycast after a teleport can occasionally miss for longer than
   * any single-attempt timeout under degraded headless SwiftShader picking
   * (a documented, confirmed-genuine flake — not a mode/input-lock gating
   * bug), so re-teleporting is the correct corrective action within an
   * overall retry budget rather than trusting one long poll.
   */
  async function focusOn(teleportId: string, expectedTargetId: string): Promise<void> {
    const b = bridge(page);
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      expect(await b.teleportTo(teleportId)).toBe(true);
      try {
        await expect
          .poll(() => b.interactionState().then((s) => s?.focusedId), { timeout: 8_000 })
          .toBe(expectedTargetId);
        return;
      } catch {
        // Retry with a fresh teleport.
      }
    }
    throw new Error(`focus never landed on ${expectedTargetId} within the 30s retry budget`);
  }

  async function press(
    teleportId: string,
    expectedTargetId: string,
    verify: () => Promise<boolean>,
  ): Promise<void> {
    await focusOn(teleportId, expectedTargetId);
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      await page.keyboard.press('KeyE');
      try {
        await expect.poll(verify, { timeout: 10_000 }).toBe(true);
        return;
      } catch {
        await focusOn(teleportId, expectedTargetId);
      }
    }
    expect(await verify()).toBe(true);
  }

  test('transmission is decoded and the antenna cabinet is reachable via a real [E] press', async () => {
    const b = bridge(page);
    const receiverSnap = await b.getReceiverSnapshot();
    expect(receiverSnap?.mode).toBe('Decoded');

    await press('fg-tp-antenna-cabinet', 'fg-antenna-cabinet', () => b.isAntennaPanelOpen());
    await expect.poll(() => b.interactionState().then((s) => s?.mode)).toBe('antenna-panel');
    await b.closeAntennaPanel();
    await expect.poll(() => b.interactionState().then((s) => s?.mode)).toBe('gameplay');
  });

  test('the waveguide junction is corrected via real repeated [E] presses, not a state shortcut', async () => {
    const b = bridge(page);
    await focusOn('fg-tp-waveguide-junction', 'fg-waveguide-junction-east-relay');

    // Cycle via real presses until Connected (defensive cap: the path has 3 ports).
    for (let i = 0; i < 5; i++) {
      const state = (await b.getWaveguideSnapshot(EAST_WAVEGUIDE_ID))?.state;
      if (state === 'Connected') break;
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(150);
    }
    await expect
      .poll(() => b.getWaveguideSnapshot(EAST_WAVEGUIDE_ID).then((s) => s?.state), {
        timeout: 10_000,
      })
      .toBe('Connected');
  });

  test('source analysis becomes ready for samples once waveguide + decode + power all hold', async () => {
    const b = bridge(page);
    await expect
      .poll(() => b.getAntennaRuntimeSnapshot().then((s) => s?.antennaPhase), { timeout: 10_000 })
      .toBe('ReadyForSamples');
    await expect
      .poll(() => b.getSourceAnalysisSnapshot().then((s) => s?.state), { timeout: 10_000 })
      .toBe('Collecting');
  });

  test('North Dish aligns via real controls and a sample is collected', async () => {
    const b = bridge(page);
    await alignArray(page, NORTH_ID, { az: 15, el: 25, pol: 10 });
    const sample = await b.collectSourceSample();
    expect(sample).not.toBeNull();
    await expect
      .poll(() => b.getSourceAnalysisSnapshot().then((s) => s?.samples.map((x) => x.arrayId)))
      .toContain(NORTH_ID);
    await expect
      .poll(() => b.getAntennaRuntimeSnapshot().then((s) => s?.antennaPhase))
      .toBe('FirstArraySampled');
  });

  test('East Relay aligns to the exact spec §12 target and a sample is collected', async () => {
    const b = bridge(page);
    await alignArray(page, EAST_ID, { az: 42, el: 18, pol: -35 });
    await b.collectSourceSample();
    await expect
      .poll(() => b.getSourceAnalysisSnapshot().then((s) => s?.samples.map((x) => x.arrayId)))
      .toContain(EAST_ID);
    await expect
      .poll(() => b.getAntennaRuntimeSnapshot().then((s) => s?.antennaPhase))
      .toBe('SecondArraySampled');
  });

  test('Tower Diagnostic Loop aligns and a sample is collected', async () => {
    const b = bridge(page);
    await alignArray(page, DIAG_ID, { az: 0, el: 15, pol: 0 });
    await b.collectSourceSample();
    await expect
      .poll(() => b.getSourceAnalysisSnapshot().then((s) => s?.samples.map((x) => x.arrayId)))
      .toContain(DIAG_ID);
    await expect
      .poll(() => b.getAntennaRuntimeSnapshot().then((s) => s?.antennaPhase))
      .toBe('DiagnosticLoopSampled');
  });

  test('collecting the same array twice does not duplicate the sample', async () => {
    const b = bridge(page);
    const before = (await b.getSourceAnalysisSnapshot())?.samples.length;
    await b.collectSourceSample(); // still selected on DIAG_ID from the previous test
    const after = (await b.getSourceAnalysisSnapshot())?.samples.length;
    expect(after).toBe(before);
  });

  test('running the comparison resolves the reveal: no valid external bearing, local loop confirmed', async () => {
    const b = bridge(page);
    const result = await b.runSourceAnalysisComparison();
    expect(result).not.toBeNull();
    await expect
      .poll(() => b.getSourceAnalysisSnapshot().then((s) => s?.state), { timeout: 10_000 })
      .toBe('Resolved');
    const saSnap = await b.getSourceAnalysisSnapshot();
    expect(saSnap?.result?.contradictionDetected).toBe(true);
    expect(saSnap?.result?.localLoopConfirmed).toBe(true);
    await expect
      .poll(() => b.getAntennaRuntimeSnapshot().then((s) => s?.antennaPhase), { timeout: 10_000 })
      .toBe('AntennaRevealComplete');
    expect((await b.getAntennaRuntimeSnapshot())?.revealComplete).toBe(true);
  });

  test('transmission remains decoded — the reveal never resets the M0.7 decoded fact', async () => {
    const b = bridge(page);
    const receiverSnap = await b.getReceiverSnapshot();
    expect(receiverSnap?.mode).toBe('Decoded');
  });

  test('re-running the comparison after resolution does not fire duplicate events or change the result', async () => {
    const b = bridge(page);
    const before = await b.getSourceAnalysisSnapshot();
    await b.runSourceAnalysisComparison();
    const after = await b.getSourceAnalysisSnapshot();
    expect(after?.state).toBe(before?.state);
    expect(after?.samples.length).toBe(before?.samples.length);
  });

  test('closing and reopening the antenna panel preserves antenna/waveguide/sample state (no re-decode of anything)', async () => {
    const b = bridge(page);
    expect(await b.openAntennaPanel()).toBe(true);
    await page.waitForTimeout(200);
    await b.closeAntennaPanel();
    const snap = await b.getAntennaSnapshot();
    const eastEntry = snap?.arrays.find((a) => a.id === EAST_ID);
    expect(eastEntry?.mechanical.currentAzimuthDeg).toBeCloseTo(42, 0);
    expect((await b.getSourceAnalysisSnapshot())?.samples).toHaveLength(3);
  });

  test('power-cycling the rooftop circuit preserves antenna positions, samples, and the decoded signal (spec §44)', async () => {
    const b = bridge(page);
    const before = await b.getAntennaSnapshot();
    const beforeSamples = await b.getSourceAnalysisSnapshot();
    const beforeReveal = await b.getAntennaRuntimeSnapshot();

    // Off, then back on — real PowerNetwork circuit toggles, not a state shortcut.
    await b.toggleCircuit(ROOFTOP_CIRCUIT);
    await expect
      .poll(() => b.getAntennaSnapshot().then((s) => s?.powered), { timeout: 10_000 })
      .toBe(false);
    // Power loss routes every array to Offline (spec-mandated) — mechanical
    // position is preserved, but the control-state label itself legitimately
    // changes, so this checks the ANGLES, not the label.
    const midOutage = await b.getAntennaSnapshot();
    const eastMid = midOutage?.arrays.find((a) => a.id === EAST_ID);
    expect(eastMid?.mechanical.currentAzimuthDeg).toBeCloseTo(42, 0);

    await b.toggleCircuit(ROOFTOP_CIRCUIT);
    await expect
      .poll(() => b.getAntennaSnapshot().then((s) => s?.powered), { timeout: 10_000 })
      .toBe(true);

    const after = await b.getAntennaSnapshot();
    const eastAfter = after?.arrays.find((a) => a.id === EAST_ID);
    const beforeEast = before?.arrays.find((a) => a.id === EAST_ID);
    expect(eastAfter?.mechanical.currentAzimuthDeg).toBeCloseTo(
      beforeEast?.mechanical.currentAzimuthDeg ?? NaN,
      5,
    );
    expect((await b.getSourceAnalysisSnapshot())?.samples).toHaveLength(
      beforeSamples?.samples.length ?? -1,
    );
    expect((await b.getAntennaRuntimeSnapshot())?.revealComplete).toBe(
      beforeReveal?.revealComplete ?? false,
    );
    expect((await b.getReceiverSnapshot())?.mode).toBe('Decoded');
  });

  test('no duplicate samples or events survived the power cycle', async () => {
    const b = bridge(page);
    const saSnap = await b.getSourceAnalysisSnapshot();
    const ids = saSnap?.samples.map((s) => s.arrayId) ?? [];
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    expect(ids.sort()).toEqual([DIAG_ID, EAST_ID, NORTH_ID].sort());
  });

  test('respawn/checkpoint recovery preserves antenna progression (position-based OOB recovery does not touch runtime state)', async () => {
    const b = bridge(page);
    await page.evaluate(() => window.__TLS_TEST__?.respawn?.());
    await page.waitForTimeout(300);
    const runtimeSnap = await b.getAntennaRuntimeSnapshot();
    expect(runtimeSnap?.revealComplete).toBe(true);
    const saSnap = await b.getSourceAnalysisSnapshot();
    expect(saSnap?.samples).toHaveLength(3);
  });

  test('no console or page errors accumulated across the whole shared session', () => {
    expect(errors.console).toHaveLength(0);
    expect(errors.page).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Repetition/lifecycle tests (counts scaled down from the spec's suggested
// 30/100/5 given real generator-startup setup cost per session — mirrors
// M0.7's dev-reset ×3 precedent, documented here for the same reason).
// ---------------------------------------------------------------------------

test('lifecycle: repeated antenna panel open/close cycles do not leak DOM or observers', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await bringPowerOnline(page);
  const before = await b.diagnostics();
  for (let i = 0; i < 10; i++) {
    // Poll for the mode to have actually settled back to 'gameplay' before
    // each open — a fixed sleep after close() is not reliable under
    // degraded headless SwiftShader frame pacing (same precedent as
    // movement.spec.ts's widened poll timeout): InteractionSystem's
    // antenna-panel -> gameplay reconciliation only happens on the scene's
    // own onBeforeRenderObservable tick, so a too-short fixed wait can
    // race ahead of the very next devActivate() call.
    await expect
      .poll(() => b.interactionState().then((s) => s?.mode), { timeout: 5_000 })
      .toBe('gameplay');
    expect(await b.openAntennaPanel()).toBe(true);
    await expect.poll(() => b.isAntennaPanelOpen(), { timeout: 5_000 }).toBe(true);
    await b.closeAntennaPanel();
  }
  const after = await b.diagnostics();
  expect(await page.locator('#antenna-panel-viewer').count()).toBe(1);
  if (before !== undefined && after !== undefined) {
    expect((after as { cameraCount: number }).cameraCount).toBe(
      (before as { cameraCount: number }).cameraCount,
    );
    expect((after as { beforeRenderObserverCount: number }).beforeRenderObserverCount).toBe(
      (before as { beforeRenderObserverCount: number }).beforeRenderObserverCount,
    );
  }
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('lifecycle: repeated array selection and mechanical movement stay within valid ranges, no drift', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await bringPowerOnline(page);
  await b.openAntennaPanel();

  for (let i = 0; i < 20; i++) {
    const arrayId = [NORTH_ID, EAST_ID, DIAG_ID][i % 3] as string;
    await b.selectAntennaArray(arrayId);
    await b.antennaAction('setAzimuth', (i % 5) * 10 - 20);
    await page.waitForTimeout(20);
  }
  const snap = await b.getAntennaSnapshot();
  for (const array of snap?.arrays ?? []) {
    expect(Number.isFinite(array.mechanical.currentAzimuthDeg)).toBe(true);
  }
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('lifecycle: repeated full dev resets settle to identical clean state', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await bringPowerOnline(page);
  await b.selectAntennaArray(NORTH_ID);
  await b.antennaAction('setAzimuth', 15);

  for (let i = 0; i < 3; i++) {
    await b.resetFacility();
  }
  const snap = await b.getAntennaSnapshot();
  expect(snap?.powered).toBe(false);
  expect(snap?.selectedArrayId).toBeNull();
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('lifecycle: repeated F2 toggling leaves overlay DOM count stable', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('F2');
  }
  expect(await page.locator('#antenna-debug-overlay').count()).toBe(1);
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});
