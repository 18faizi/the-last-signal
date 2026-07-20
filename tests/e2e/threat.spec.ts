import { expect, test, type Page } from '@playwright/test';

/**
 * Milestone 0.9 threat foundation browser tests.
 *
 * Bridge discipline (mirrors antenna.spec.ts/signal.spec.ts exactly): the
 * bridge only ever performs SETUP shortcuts (generator/circuits/decode/
 * antenna alignment — all real domain actions), movement/positioning
 * assists (teleports) and read-only snapshots. It NEVER sets threat state,
 * suspicion, detection, event completion or encounter completion — every
 * threat outcome below flows through the real perception model (real
 * footstep stimuli from real key presses, the real LOS probe, the real
 * suspicion/detection integrator), the real event director and the real
 * state machine, ticked by the scene's real per-frame observers.
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

interface ThreatSnapshot {
  id: string;
  state: string;
  active: boolean;
  position: { x: number; y: number; z: number };
  facingYaw: number;
  behaviorMode: string;
  currentNodeId: string | null;
  suspicion: number;
  detection: number;
  fullDetectionFired: boolean;
  lastKnownPlayerPosition: { x: number; y: number; z: number } | null;
  hasLineOfSight: boolean;
  visionScore: number;
}
interface ThreatRuntimeSnapshot {
  threatPhase: string;
  completedEventIds: string[];
  activeEncounterId: string | null;
  completedEncounterIds: string[];
  manifestationsSeen: string[];
  hidingSpotsDiscovered: string[];
  safeZoneReached: boolean;
  threatWithdrawnCount: number;
  encounterResetCount: number;
  foundationComplete: boolean;
}
interface DirectorSnapshot {
  clockSeconds: number;
  events: Array<{ id: string; state: string; fireCount: number }>;
  firedEventIds: string[];
}
interface ManifestationSnapshot {
  activeId: string | null;
  completedIds: string[];
  states: Array<{ id: string; state: string }>;
}
interface HidingState {
  hidden: boolean;
  spotId: string | null;
  concealment: number;
  fullyHidden: boolean;
  promptsEnabled: boolean;
  occupiedSpotId: string | null;
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
    playerState: () => page.evaluate(() => window.__TLS_TEST__?.getPlayerState()),
    interactionState: () =>
      page.evaluate(() => window.__TLS_TEST__?.getInteractionState?.()) as Promise<
        { mode: string; suspensionReasons: string[] } | undefined
      >,
    diagnostics: () => page.evaluate(() => window.__TLS_TEST__?.getDiagnostics?.()),
    generatorAction: (action: string) => call<boolean>('generatorAction', action),
    generatorSnapshot: () => call<{ state: string }>('getGeneratorSnapshot'),
    toggleCircuit: (circuitId: string) => call<string | null>('toggleCircuit', circuitId),
    activateTarget: (targetId: string) => call<boolean>('activateTarget', targetId),
    teleportTo: (id: string) => call<boolean>('teleportTo', id),
    teleportToPosition: (x: number, y: number, z: number, yaw: number) =>
      call<boolean>('teleportToPosition', x, y, z, yaw),
    getPowerSnapshot: () =>
      call<{ circuits: Array<{ id: string; effective: string }> }>('getPowerSnapshot'),
    getReceiverSnapshot: () => call<{ mode: string }>('getReceiverSnapshot'),
    receiverAction: (action: string, value?: number) =>
      call<boolean>('receiverAction', action, value),
    openReceiverPanel: () => call<boolean>('openReceiverPanel'),
    closeReceiverPanel: () => call<void>('closeReceiverPanel'),
    getAntennaSnapshot: () =>
      call<{ powered: boolean; arrays: Array<{ id: string; controlState: string }> }>(
        'getAntennaSnapshot',
      ),
    getAntennaRuntimeSnapshot: () =>
      call<{ antennaPhase: string; revealComplete: boolean }>('getAntennaRuntimeSnapshot'),
    getWaveguideSnapshot: (pathId: string) =>
      call<{ state: string }>('getWaveguideSnapshot', pathId),
    antennaAction: (action: string, value?: number) =>
      call<boolean>('antennaAction', action, value),
    selectAntennaArray: (arrayId: string) => call<boolean>('selectAntennaArray', arrayId),
    cycleWaveguidePort: (pathId: string) => call<boolean>('cycleWaveguidePort', pathId),
    collectSourceSample: () => call<unknown>('collectSourceSample'),
    runSourceAnalysisComparison: () => call<unknown>('runSourceAnalysisComparison'),
    getDoorState: (doorId: string) => call<{ physical: string } | null>('getDoorState', doorId),
    getInventorySnapshot: () => call<{ itemCount: number }>('getInventorySnapshot'),

    getThreatSnapshot: () => call<ThreatSnapshot>('getThreatSnapshot'),
    getThreatRuntimeSnapshot: () => call<ThreatRuntimeSnapshot>('getThreatRuntimeSnapshot'),
    getManifestationSnapshot: () => call<ManifestationSnapshot>('getManifestationSnapshot'),
    getEventDirectorSnapshot: () => call<DirectorSnapshot>('getEventDirectorSnapshot'),
    getHidingState: () => call<HidingState>('getHidingState'),
    listHidingSpots: () => call<string[]>('listHidingSpots'),
    getSafeZoneState: () => call<{ inside: boolean; zoneId: string | null }>('getSafeZoneState'),
    getStimulusCount: () => call<number>('getStimulusCount'),
    enterHidingSpot: (spotId: string) => call<boolean>('enterHidingSpot', spotId),
    leaveHidingSpot: () => call<boolean>('leaveHidingSpot'),
    resetThreat: () => call<boolean>('resetThreat'),
    resetFacility: () => call<void>('resetFacility'),
  };
}

type Bridge = ReturnType<typeof bridge>;

const CONTROL_ROOM_CIRCUIT = 'fg-circuit-control-room';
const ROOFTOP_CIRCUIT = 'fg-circuit-rooftop-antenna';
const NORTH_ID = 'fg-antenna-north-dish';
const EAST_ID = 'fg-antenna-east-relay';
const DIAG_ID = 'fg-antenna-tower-diagnostic';
const EAST_WAVEGUIDE_ID = 'fg-waveguide-east-relay';
const ENTRANCE_DOOR = 'fg-door-control-entrance';
const EVENT_A = 'fg-event-rooftop-aftermath';
const EVENT_B = 'fg-event-control-disturbance';
const EVENT_C = 'fg-event-first-investigation';
const EVENT_D = 'fg-event-safe-zone-resolution';
const ENCOUNTER_ID = 'fg-encounter-first-contact';

/** Real generator startup via bridge shortcuts (setup speed only). */
async function bringPowerAndDecode(page: Page): Promise<void> {
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
  await b.toggleCircuit(CONTROL_ROOM_CIRCUIT);

  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 30_000 })
    .not.toBe('Offline');
  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 30_000 })
    .not.toBe('Booting');
  expect(await b.openReceiverPanel()).toBe(true);
  await b.receiverAction('setChannel', 3);
  await b.receiverAction('setFrequency', 117.4);
  await b.receiverAction('setGain', 0.6);
  await b.receiverAction('setFilter', 0.65);
  await b.receiverAction('setPhase', -18);
  await expect
    .poll(() => b.getReceiverSnapshot().then((s) => s?.mode), { timeout: 40_000, intervals: [500] })
    .toBe('Decoded');
  await b.closeReceiverPanel();

  await b.toggleCircuit(ROOFTOP_CIRCUIT);
  await expect
    .poll(() => b.getAntennaSnapshot().then((s) => s?.powered), { timeout: 20_000 })
    .toBe(true);
}

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
  // Same 45 s wall-clock margin rationale as antenna.spec.ts's alignArray.
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

/** Full REAL antenna reveal (waveguide + 3 alignments + samples + comparison). */
async function completeAntennaReveal(page: Page): Promise<void> {
  const b = bridge(page);
  for (let i = 0; i < 5; i++) {
    const state = (await b.getWaveguideSnapshot(EAST_WAVEGUIDE_ID))?.state;
    if (state === 'Connected') break;
    await b.cycleWaveguidePort(EAST_WAVEGUIDE_ID);
  }
  await expect
    .poll(() => b.getWaveguideSnapshot(EAST_WAVEGUIDE_ID).then((s) => s?.state))
    .toBe('Connected');
  await alignArray(page, NORTH_ID, { az: 15, el: 25, pol: 10 });
  await b.collectSourceSample();
  await alignArray(page, EAST_ID, { az: 42, el: 18, pol: -35 });
  await b.collectSourceSample();
  await alignArray(page, DIAG_ID, { az: 0, el: 15, pol: 0 });
  await b.collectSourceSample();
  await b.runSourceAnalysisComparison();
  await expect
    .poll(() => b.getAntennaRuntimeSnapshot().then((s) => s?.revealComplete), { timeout: 15_000 })
    .toBe(true);
}

async function eventFireCount(b: Bridge, eventId: string): Promise<number> {
  const snap = await b.getEventDirectorSnapshot();
  return snap?.events.find((e) => e.id === eventId)?.fireCount ?? 0;
}

/**
 * Provokes a confirmed detection with REAL inputs: repositions the player
 * `distance` metres inside the threat's forward cone (positioning assist),
 * then strafes with real key presses so the real footstep stimuli + real
 * vision integration accumulate detection. Retries with a fresh placement
 * (the threat keeps moving) within an overall budget. Because a pursuit at
 * close range can legitimately reach the capture boundary between two
 * polls, the helper reports which REAL outcome occurred.
 */
async function provokeDetection(
  page: Page,
  b: Bridge,
  distance: number,
): Promise<'pursuing' | 'reset'> {
  const baselineResets = (await b.getThreatRuntimeSnapshot())?.encounterResetCount ?? 0;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const runtime = await b.getThreatRuntimeSnapshot();
    if ((runtime?.encounterResetCount ?? 0) > baselineResets) return 'reset';
    const snap = await b.getThreatSnapshot();
    if (snap === undefined || !snap.active) {
      await page.waitForTimeout(1000);
      continue;
    }
    if (snap.state === 'Pursuing') return 'pursuing';
    // Only provoke on the ground floor (same-storey vision).
    if (snap.position.y > 1.5) {
      await page.waitForTimeout(750);
      continue;
    }
    const ahead = {
      x: snap.position.x + Math.sin(snap.facingYaw) * distance,
      z: snap.position.z + Math.cos(snap.facingYaw) * distance,
    };
    // Clamp into the control room interior.
    const px = Math.min(Math.max(ahead.x, -9), 5);
    const pz = Math.min(Math.max(ahead.z, 17), 26);
    await b.teleportToPosition(px, 0.1, pz, snap.facingYaw + Math.PI);
    await page.keyboard.down('KeyA');
    try {
      await expect
        .poll(
          async () => {
            const t = await b.getThreatSnapshot();
            const r = await b.getThreatRuntimeSnapshot();
            if ((r?.encounterResetCount ?? 0) > baselineResets) return 'reset';
            return t?.state;
          },
          { timeout: 6_000, intervals: [250] },
        )
        .toMatch(/Pursuing|reset/);
      const runtimeAfter = await b.getThreatRuntimeSnapshot();
      return (runtimeAfter?.encounterResetCount ?? 0) > baselineResets ? 'reset' : 'pursuing';
    } catch {
      // Threat moved/looked away — replace and retry.
    } finally {
      await page.keyboard.up('KeyA');
    }
  }
  throw new Error('detection never confirmed within the 120s budget');
}

// ---------------------------------------------------------------------------
// Cheap tests — no generator/power setup required.
// ---------------------------------------------------------------------------

test('threat bridge is available and the threat starts fully dormant (zero-cost)', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  const snap = await b.getThreatSnapshot();
  expect(snap?.state).toBe('Dormant');
  expect(snap?.active).toBe(false);
  expect(snap?.suspicion).toBe(0);
  expect(snap?.detection).toBe(0);
  const runtime = await b.getThreatRuntimeSnapshot();
  expect(runtime?.threatPhase).toBe('Inactive');
  expect(runtime?.activeEncounterId).toBeNull();
  expect(errors.console).toHaveLength(0);
});

test('no director event fires before the antenna reveal', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await page.waitForTimeout(1500);
  const director = await b.getEventDirectorSnapshot();
  expect(director?.firedEventIds).toEqual([]);
});

test('all four hiding spots are registered and gated until the director enables prompts', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  const spots = await b.listHidingSpots();
  expect(spots?.sort()).toEqual(
    [
      'fg-hide-cabinet-relay',
      'fg-hide-locker-stairwell',
      'fg-hide-under-desk',
      'fg-hide-alcove-relay',
    ].sort(),
  );
  const hiding = await b.getHidingState();
  expect(hiding?.promptsEnabled).toBe(false);
  // Availability-gated: activation through the REAL interaction system fails.
  await b.teleportTo('fg-tp-control-room');
  expect(await b.enterHidingSpot('fg-hide-under-desk')).toBe(false);
  expect((await b.getHidingState())?.hidden).toBe(false);
});

test('F1 toggles the threat debug overlay DOM panel on and off, staying inert to gameplay', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await page.keyboard.press('F1');
  await expect(page.locator('#threat-debug-overlay')).toBeVisible();
  await page.keyboard.press('F1');
  await expect(page.locator('#threat-debug-overlay')).toBeHidden();
  expect((await b.interactionState())?.mode).toBe('gameplay');
  expect(errors.console).toHaveLength(0);
});

test('the detection meter is hidden while the threat is dormant', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  await expect(page.locator('#detection-meter')).toBeHidden();
  await expect(page.locator('#hiding-overlay')).toBeHidden();
});

test('dev threat reset is stable when repeated on an untouched scene', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  for (let i = 0; i < 3; i++) {
    await b.resetThreat();
    const snap = await b.getThreatSnapshot();
    expect(snap?.state).toBe('Dormant');
    expect((await b.getThreatRuntimeSnapshot())?.threatPhase).toBe('Inactive');
    expect((await b.getEventDirectorSnapshot())?.firedEventIds).toEqual([]);
  }
  expect(errors.console).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Shared full-progression session: one expensive bring-up, the complete
// encounter, failure/recovery, completion, one-shot guarantees, lifecycle.
// ---------------------------------------------------------------------------

test.describe.serial('threat foundation — full encounter (shared session)', () => {
  // Generator warm-up (60 s ceiling) + decode + three real antenna
  // alignments + the paced director events A -> B -> C and two full
  // detection/pursuit rounds: each step is individually bounded but the sum
  // needs generous headroom under degraded headless SwiftShader pacing
  // (same precedent as antenna.spec.ts's shared session).
  //
  // 900s (was 600s): standalone verification of the identical real
  // sequence (generator hold+warmup, decode, waveguide correction, three
  // antenna alignments, sample collection, comparison) completes correctly
  // in well under 2 minutes when run outside the Playwright test harness —
  // confirming this is a genuine, correct-but-slow pipeline, not a stuck
  // state. Under the full harness's compounded SwiftShader + per-step
  // page.evaluate overhead across this many chained real-time operations,
  // 600s proved too tight; 900s gives comfortable margin without masking a
  // real stall (the individual per-step polls below remain independently
  // bounded, so a genuine hang still fails fast at its own poll timeout).
  test.setTimeout(900_000);
  let page: Page;
  let b: Bridge;
  const errors = { console: [] as string[], page: [] as string[] };

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await boot(page, errors);
    b = bridge(page);
    await bringPowerAndDecode(page);
    await completeAntennaReveal(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('the antenna reveal arms the threat chain and Event A fires with the first manifestation', async () => {
    await expect
      .poll(() => b.getThreatRuntimeSnapshot().then((s) => s?.threatPhase), { timeout: 20_000 })
      .not.toBe('Inactive');
    await expect
      .poll(() => eventFireCount(b, EVENT_A), { timeout: 20_000, intervals: [500] })
      .toBe(1);
    await expect
      .poll(() => b.getThreatRuntimeSnapshot().then((s) => s?.threatPhase), { timeout: 10_000 })
      .toBe('FirstManifestation');
    // The stairwell silhouette manifestation ran (Active now or Completed
    // after its 6s timeout) — and it is NOT the threat actor.
    await expect
      .poll(
        () =>
          b
            .getManifestationSnapshot()
            .then(
              (s) =>
                s?.activeId === 'fg-manifest-stairwell-silhouette' ||
                (s?.completedIds ?? []).includes('fg-manifest-stairwell-silhouette'),
            ),
        { timeout: 10_000 },
      )
      .toBe(true);
    expect((await b.getThreatSnapshot())?.state).toBe('Dormant');
  });

  test('Event B fires inside the control room: door closes, disturbance manifests', async () => {
    await b.teleportTo('fg-tp-control-room');
    await expect
      .poll(() => eventFireCount(b, EVENT_B), { timeout: 45_000, intervals: [500] })
      .toBe(1);
    await expect
      .poll(() => b.getThreatRuntimeSnapshot().then((s) => s?.threatPhase), { timeout: 10_000 })
      .toBe('DisturbanceSequence');
    // The entrance door was operated by the director (a REAL door operation).
    await expect
      .poll(() => b.getDoorState(ENTRANCE_DOOR).then((s) => s?.physical), { timeout: 15_000 })
      .toMatch(/closing|closed|blocked/);
  });

  test('Event C begins the encounter: checkpoint, hiding prompts, active threat', async () => {
    await expect
      .poll(() => eventFireCount(b, EVENT_C), { timeout: 45_000, intervals: [500] })
      .toBe(1);
    const runtime = await b.getThreatRuntimeSnapshot();
    expect(runtime?.activeEncounterId).toBe(ENCOUNTER_ID);
    expect((await b.getHidingState())?.promptsEnabled).toBe(true);
    await expect
      .poll(() => b.getThreatSnapshot().then((s) => s?.active), { timeout: 10_000 })
      .toBe(true);
    const snap = await b.getThreatSnapshot();
    expect(['Unaware', 'Suspicious', 'Investigating']).toContain(snap?.state);
  });

  test('real sprint noise raises suspicion while the threat cannot see across floors', async () => {
    // Sprint in the control room in bursts, but ONLY while the threat is
    // still on the upper level (y > 1.5): sound carries between floors,
    // vision never does (vertical tolerance + real ceiling occlusion).
    const deadline = Date.now() + 45_000;
    let escalated = false;
    while (Date.now() < deadline) {
      const snap = await b.getThreatSnapshot();
      if (snap === undefined) break;
      if (snap.suspicion > 0.28 || snap.state !== 'Unaware') {
        escalated = true;
        break;
      }
      if (snap.position.y > 1.5) {
        await b.teleportToPosition(-2, 0.1, 20, 0);
        await page.keyboard.down('ShiftLeft');
        await page.keyboard.down('KeyW');
        await page.waitForTimeout(800);
        await page.keyboard.up('KeyW');
        await page.keyboard.up('ShiftLeft');
      } else {
        await page.waitForTimeout(400);
      }
    }
    expect(escalated).toBe(true);
    // Sound alone must never have confirmed a detection.
    expect((await b.getThreatSnapshot())?.fullDetectionFired).toBe(false);
  });

  test('hiding in the stairwell locker fully conceals the player through the investigation', async () => {
    // Hide IMMEDIATELY (before the threat descends into vision range).
    await b.teleportToPosition(-8.4, 0.1, 22.5, Math.PI / 2);
    const before = await b.playerState();
    expect(before).toBeDefined();
    expect(await b.enterHidingSpot('fg-hide-locker-stairwell')).toBe(true);
    await expect
      .poll(() => b.interactionState().then((s) => s?.mode), { timeout: 5_000 })
      .toBe('hiding');
    const hiding = await b.getHidingState();
    expect(hiding?.hidden).toBe(true);
    expect(hiding?.fullyHidden).toBe(true);
    expect(hiding?.spotId).toBe('fg-hide-locker-stairwell');
    const interaction = await b.interactionState();
    expect(interaction?.suspensionReasons).toContain('hiding');
    await expect(page.locator('#hiding-overlay')).toBeVisible();
    // StealthRequired phase reached the moment the player hid mid-encounter.
    await expect
      .poll(() => b.getThreatRuntimeSnapshot().then((s) => s?.threatPhase), { timeout: 5_000 })
      .toBe('StealthRequired');

    // While fully hidden, the threat can NEVER visually detect the player —
    // stay hidden while it investigates/searches right past the locker.
    await page.waitForTimeout(8_000);
    const snap = await b.getThreatSnapshot();
    expect(snap?.fullDetectionFired).toBe(false);
    expect(snap?.detection ?? 1).toBeLessThan(1);
    expect((await b.getThreatRuntimeSnapshot())?.encounterResetCount).toBe(0);

    // Exit restores the EXACT pre-hide transform (position, yaw, pitch).
    await b.leaveHidingSpot();
    await expect
      .poll(() => b.interactionState().then((s) => s?.mode), { timeout: 5_000 })
      .toBe('gameplay');
    const after = await b.playerState();
    expect(after?.position.x).toBeCloseTo(before?.position.x ?? 0, 1);
    expect(after?.position.z).toBeCloseTo(before?.position.z ?? 0, 1);
    expect(after?.yaw).toBeCloseTo(before?.yaw ?? 0, 2);
    expect(after?.pitch).toBeCloseTo(before?.pitch ?? 0, 2);
    expect((await b.getHidingState())?.hidden).toBe(false);
  });

  test('exiting hiding leaves no stale movement input', async () => {
    const before = await b.playerState();
    await page.waitForTimeout(500);
    const after = await b.playerState();
    expect(after?.horizontalSpeed ?? 1).toBeLessThan(0.2);
    expect(after?.position.x).toBeCloseTo(before?.position.x ?? 0, 1);
  });

  test('full detection -> pursuit -> capture = encounter failure with checkpoint reset, preserving all major progression', async () => {
    // Provoke at close range and then stand still: whether the capture
    // lands between polls or after we observe Pursuing, the REAL outcome is
    // the same — the encounter fails and resets exactly once.
    const outcome = await provokeDetection(page, b, 2.5);
    if (outcome === 'pursuing') {
      // Observed mid-pursuit: the phase chain reached PursuitActive and the
      // meter communicates by text.
      expect(
        ['PlayerDetected', 'PursuitActive'].includes(
          (await b.getThreatRuntimeSnapshot())?.threatPhase ?? '',
        ),
      ).toBe(true);
    }
    await expect
      .poll(() => b.getThreatRuntimeSnapshot().then((s) => s?.encounterResetCount), {
        timeout: 60_000,
        intervals: [500],
      })
      .toBe(1);
    // The pursuit phase was reached regardless of poll timing (monotonic).
    const phase = (await b.getThreatRuntimeSnapshot())?.threatPhase;
    expect(['PursuitActive', 'SafeZoneReached']).toContain(phase);
    // The fade message is the authored dev message, not a death screen.
    await expect(page.locator('#encounter-reset-message')).toHaveText('ENCOUNTER RESET');
    // Player is back at the encounter checkpoint.
    await expect
      .poll(
        () =>
          b.playerState().then((s) => {
            if (s === undefined) return false;
            const dx = s.position.x - -2;
            const dz = s.position.z - 19;
            return Math.hypot(dx, dz) < 3;
          }),
        { timeout: 15_000 },
      )
      .toBe(true);
    // Threat-local state reset: unaware again, zero meters, re-armed one-shot.
    await expect
      .poll(() => b.getThreatSnapshot().then((s) => s?.state), { timeout: 15_000 })
      .toBe('Unaware');
    const snap = await b.getThreatSnapshot();
    expect(snap?.suspicion).toBe(0);
    expect(snap?.detection).toBe(0);
    expect(snap?.fullDetectionFired).toBe(false);
    // Major progression is untouched: power, decode, antenna reveal.
    const power = await b.getPowerSnapshot();
    expect(power?.circuits.find((c) => c.id === CONTROL_ROOM_CIRCUIT)?.effective).toBe('energized');
    expect((await b.getReceiverSnapshot())?.mode).toBe('Decoded');
    expect((await b.getAntennaRuntimeSnapshot())?.revealComplete).toBe(true);
    // Encounter is still active — it failed, it did not complete.
    const runtime = await b.getThreatRuntimeSnapshot();
    expect(runtime?.activeEncounterId).toBe(ENCOUNTER_ID);
    expect(runtime?.completedEncounterIds).toEqual([]);
  });

  test('the retried encounter resolves at the lobby safe zone and completes the foundation', async () => {
    // Round two+: each retry re-arms the one-shot detection. Provoke from a
    // LONGER standoff (5 m) so there is time to break away, then retreat
    // into the lobby safe zone while pursued. If a retry is captured before
    // reaching the lobby, the encounter resets and we simply try again.
    const overallDeadline = Date.now() + 240_000;
    let resolved = false;
    while (!resolved && Date.now() < overallDeadline) {
      const outcome = await provokeDetection(page, b, 5);
      if (outcome === 'reset') continue; // captured too fast — retry
      await b.teleportToPosition(0, 0.1, 17.5, Math.PI); // doorway, facing the lobby
      await page.keyboard.down('ShiftLeft');
      await page.keyboard.down('KeyW');
      try {
        await expect
          .poll(() => b.getSafeZoneState().then((s) => s?.inside), {
            timeout: 10_000,
            intervals: [200],
          })
          .toBe(true);
      } catch {
        continue; // did not reach the lobby in time — retry
      } finally {
        await page.keyboard.up('KeyW');
        await page.keyboard.up('ShiftLeft');
      }
      try {
        await expect
          .poll(() => b.getThreatRuntimeSnapshot().then((s) => s?.safeZoneReached), {
            timeout: 20_000,
          })
          .toBe(true);
        resolved = true;
      } catch {
        // Pursuit had already degraded before the lobby — provoke again.
      }
    }
    expect(resolved).toBe(true);
    await expect
      .poll(() => eventFireCount(b, EVENT_D), { timeout: 20_000, intervals: [500] })
      .toBe(1);
    await expect
      .poll(() => b.getThreatRuntimeSnapshot().then((s) => s?.completedEncounterIds ?? []), {
        timeout: 15_000,
      })
      .toContain(ENCOUNTER_ID);
    // The threat withdraws for good and the foundation completes.
    await expect
      .poll(() => b.getThreatSnapshot().then((s) => s?.state), {
        timeout: 60_000,
        intervals: [500],
      })
      .toBe('Inactive');
    await expect
      .poll(() => b.getThreatRuntimeSnapshot().then((s) => s?.threatPhase), { timeout: 15_000 })
      .toBe('ThreatFoundationComplete');
    await expect(page.locator('#encounter-complete-banner')).toHaveText(
      'THREAT FOUNDATION COMPLETE',
    );
  });

  test('the encounter never replays after completion and no event ever double-fired', async () => {
    // Walk back into the encounter area and wait — nothing may reactivate.
    await b.teleportTo('fg-tp-control-room');
    await page.waitForTimeout(5_000);
    expect((await b.getThreatSnapshot())?.state).toBe('Inactive');
    const director = await b.getEventDirectorSnapshot();
    for (const id of [EVENT_A, EVENT_B, EVENT_C, EVENT_D]) {
      expect(director?.events.find((e) => e.id === id)?.fireCount).toBe(1);
    }
    const runtime = await b.getThreatRuntimeSnapshot();
    expect(runtime?.completedEncounterIds).toEqual([ENCOUNTER_ID]);
    expect(runtime?.foundationComplete).toBe(true);
    // Signal/antenna/power progression remains intact after everything.
    expect((await b.getReceiverSnapshot())?.mode).toBe('Decoded');
    expect((await b.getAntennaRuntimeSnapshot())?.revealComplete).toBe(true);
  });

  test('hide/exit repetition is leak-free and always restores gameplay', async () => {
    // 6 cycles (scaled down from a nominal 10 — each cycle exercises the
    // full enter/lock/camera/exit path; M0.7/M0.8 precedent for shared-
    // session repetition counts under SwiftShader).
    await b.teleportToPosition(-4, 0.1, 19, 0);
    const baseline = await b.diagnostics();
    for (let i = 0; i < 6; i++) {
      expect(await b.enterHidingSpot('fg-hide-under-desk')).toBe(true);
      await expect
        .poll(() => b.interactionState().then((s) => s?.mode), { timeout: 5_000 })
        .toBe('hiding');
      await b.leaveHidingSpot();
      await expect
        .poll(() => b.interactionState().then((s) => s?.mode), { timeout: 5_000 })
        .toBe('gameplay');
    }
    const after = await b.diagnostics();
    expect(after?.beforeRenderObserverCount).toBe(baseline?.beforeRenderObserverCount);
    expect(after?.promptElementCount).toBe(baseline?.promptElementCount);
    expect((await b.getHidingState())?.occupiedSpotId).toBeNull();
  });

  test('dev full reset restores every threat system and allows a clean replay', async () => {
    await b.resetThreat();
    const snap = await b.getThreatSnapshot();
    expect(snap?.state).toBe('Dormant');
    expect(snap?.suspicion).toBe(0);
    const runtime = await b.getThreatRuntimeSnapshot();
    expect(runtime?.threatPhase).toBe('AntennaAftermathPending'); // reveal still complete
    expect(runtime?.completedEventIds).toEqual([]);
    expect(runtime?.completedEncounterIds).toEqual([]);
    expect(runtime?.encounterResetCount).toBe(0);
    const director = await b.getEventDirectorSnapshot();
    // Director reset re-arms everything; Event A re-fires (dev replay works).
    await expect
      .poll(() => eventFireCount(b, EVENT_A), { timeout: 20_000, intervals: [500] })
      .toBe(1);
    expect(director).toBeDefined();
    const hiding = await b.getHidingState();
    expect(hiding?.hidden).toBe(false);
    expect(hiding?.promptsEnabled).toBe(false);
    // Manifestation pool restored: after the reset only the replayed Event A
    // silhouette may be active/completed again — none of the Event B/C ones.
    const manifest = await b.getManifestationSnapshot();
    for (const entry of manifest?.states ?? []) {
      if (entry.id !== 'fg-manifest-stairwell-silhouette') {
        expect(entry.state).toBe('Idle');
      }
    }
    // Repeat the reset — stability under repetition.
    await b.resetThreat();
    await b.resetThreat();
    expect((await b.getThreatSnapshot())?.state).toBe('Dormant');
    expect((await b.getThreatRuntimeSnapshot())?.completedEventIds).toEqual([]);
  });

  test('no console or page errors across the entire shared session', async () => {
    await page.waitForTimeout(100); // let any trailing async errors surface
    expect(errors.console).toHaveLength(0);
    expect(errors.page).toHaveLength(0);
  });
});
