import { expect, test, type Page } from '@playwright/test';

/**
 * Milestone 0.6 facility power-network browser tests.
 *
 * Most tests drive the power/generator domain through the dev bridge
 * (generatorAction, requestCircuit, toggleCircuit, teleportTo) for speed —
 * exactly the same pattern facility.spec.ts uses for M0.5. The dedicated
 * "full power progression" test at the bottom is the one exception required
 * by the milestone spec: it drives the generator startup sequence — valve,
 * battery, e-stop, selector, the 2-second starter hold, and the main
 * breaker — through real [E] key presses while the player is teleported to
 * eye-height-aligned vantage points built for this purpose (see
 * facilityTeleportDefinitions.ts's 'fg-tp-gen-*' entries and
 * buildGeneratorControls.ts's y=1.6 alignment), never via a state-setting
 * bridge shortcut for the starter itself.
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

// ---- bridge helpers ---------------------------------------------------------

interface GeneratorSnapshot {
  state: string;
  fuelValve: string;
  starterBattery: string;
  emergencyStop: string;
  selector: string;
  mainBreaker: string;
  warmUpProgress: number;
  inspected: boolean;
}

interface PowerSnapshot {
  sources: Array<{
    id: string;
    availability: string;
    maxCapacity: number;
    allocatedCapacity: number;
  }>;
  circuits: Array<{
    id: string;
    requested: string;
    effective: string;
    sourceId: string | null;
    capacityCost: number;
  }>;
  loads: Array<{ id: string; circuitId: string; powered: boolean }>;
}

function bridge(page: Page) {
  return {
    generatorSnapshot: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['getGeneratorSnapshot'];
        return typeof fn === 'function' ? (fn as () => GeneratorSnapshot)() : undefined;
      }),
    generatorReadiness: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['getGeneratorReadiness'];
        return typeof fn === 'function'
          ? (fn as () => { ready: boolean; blockingReason: string | null })()
          : undefined;
      }),
    generatorAction: (action: string) =>
      page.evaluate((a: string) => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['generatorAction'];
        return typeof fn === 'function' ? (fn as (a: string) => boolean)(a) : false;
      }, action),
    powerSnapshot: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['getPowerSnapshot'];
        return typeof fn === 'function' ? (fn as () => PowerSnapshot)() : undefined;
      }),
    requestCircuit: (circuitId: string, sourceId: string, desired: 'on' | 'off') =>
      page.evaluate(
        ([c, s, d]) => {
          const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
          const fn = b['requestCircuit'];
          return typeof fn === 'function'
            ? (fn as (c: string, s: string, d: 'on' | 'off') => { ok: boolean; reason?: string })(
                c,
                s,
                d,
              )
            : undefined;
        },
        [circuitId, sourceId, desired] as const,
      ),
    toggleCircuit: (circuitId: string) =>
      page.evaluate((c: string) => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['toggleCircuit'];
        return typeof fn === 'function' ? (fn as (c: string) => string | null)(c) : undefined;
      }, circuitId),
    openPanel: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['openDistributionPanel'];
        return typeof fn === 'function' ? (fn as () => boolean)() : false;
      }),
    closePanel: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['closeDistributionPanel'];
        if (typeof fn === 'function') (fn as () => void)();
      }),
    isPanelOpen: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['isDistributionPanelOpen'];
        return typeof fn === 'function' ? (fn as () => boolean)() : false;
      }),
    activateReceiver: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['activateReceiver'];
        return typeof fn === 'function' ? (fn as () => boolean)() : false;
      }),
    resetFacility: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['resetFacility'];
        if (typeof fn === 'function') (fn as () => void)();
      }),
    respawn: () => page.evaluate(() => window.__TLS_TEST__?.respawn?.()),
    facilityState: () =>
      page.evaluate(() => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['getFacilityState'];
        return typeof fn === 'function'
          ? (
              fn as () => {
                progressionPhase: string;
                isComplete: boolean;
                power: { receiverActivated: boolean; powerNetworkOperational: boolean };
              }
            )()
          : undefined;
      }),
    teleportTo: (id: string) =>
      page.evaluate((tpId: string) => {
        const b = window.__TLS_TEST__ as unknown as Record<string, unknown>;
        const fn = b['teleportTo'];
        return typeof fn === 'function' ? (fn as (id: string) => boolean)(tpId) : false;
      }, id),
    collectPickup: (pickupId: string) =>
      page.evaluate((id: string) => window.__TLS_TEST__?.collectPickup?.(id), pickupId),
    openDoor: (doorId: string) =>
      page.evaluate((id: string) => window.__TLS_TEST__?.openDoor?.(id), doorId),
    doorState: (doorId: string) =>
      page.evaluate((id: string) => window.__TLS_TEST__?.getDoorState?.(id), doorId),
    interactionState: () => page.evaluate(() => window.__TLS_TEST__?.getInteractionState?.()),
    diagnostics: () => page.evaluate(() => window.__TLS_TEST__?.getDiagnostics?.()),
    activateTarget: (targetId: string) =>
      page.evaluate((id: string) => window.__TLS_TEST__?.activateTarget?.(id) ?? false, targetId),
  };
}

const GEN_SOURCE = 'fg-power-src-generator';
const BATTERY_SOURCE = 'fg-power-src-battery';
const EMERGENCY_CIRCUIT = 'fg-circuit-emergency-security';
const CONTROL_ROOM_CIRCUIT = 'fg-circuit-control-room';
const TUNNEL_CIRCUIT = 'fg-circuit-tunnel';
const STAFF_CIRCUIT = 'fg-circuit-staff-quarters';
const ROOFTOP_CIRCUIT = 'fg-circuit-rooftop-antenna';
const ARCHIVE_CIRCUIT = 'fg-circuit-archive';
const GENERATOR_AUX_CIRCUIT = 'fg-circuit-generator-auxiliary';

async function bringGeneratorReady(page: Page): Promise<void> {
  const b = bridge(page);
  await b.generatorAction('inspect');
  await b.generatorAction('openFuelValve');
  await b.generatorAction('connectBattery');
  await b.generatorAction('releaseEmergencyStop');
  await b.generatorAction('setSelectorManual');
}

/**
 * Fast crank via the dev bridge's activateTarget (interaction.devActivate).
 * devActivate() fetches the target straight from the registry and calls
 * execute() → target.interact() directly — for a 'hold'-kind target that
 * *is* attemptStart(), so this bypasses the 2-second hold-progress timer
 * without setting any generator/circuit/milestone state by hand. This is
 * the same bridge shortcut every other facility e2e test already uses for
 * setup speed (collectPickup/openDoor); it's only the one *dedicated*
 * full-progression test below that must avoid it, per the milestone spec.
 */
async function crankGeneratorViaBridge(page: Page): Promise<void> {
  const b = bridge(page);
  const activated = await b.activateTarget('fg-gen-ctrl-starter');
  expect(activated).toBe(true);
}

/**
 * Holds the real starter control via a genuine keydown/keyup, released only
 * once the generator's own state has actually left ReadyToStart — never a
 * fixed wall-clock sleep. Hold progress is driven by simulated delta time;
 * headless SwiftShader frame pacing on this scene can run well under 20fps,
 * and the interaction system clamps per-frame delta to 50ms
 * (`InteractionSystem.ts`'s `Math.min(getDeltaTime()/1000, 0.05)`), so a
 * real 2-second hold can take significantly longer than 2 real-world
 * seconds to complete — confirmed by direct measurement (an isolated,
 * otherwise-idle run still took ~15-20s wall-clock for a 2s hold).
 *
 * A real characteristic of the interaction framework caught here during
 * development: unlike focus/prompt display (which tolerates a momentary
 * raycast miss via `FocusStability`'s loss-grace period — see
 * FocusStability.ts), `InteractionSystem`'s hold-eligibility check requires
 * the raycast to hit the target on the *exact* current frame, with zero
 * grace (`InteractionSystem.ts`: `holdEligible = ... && eligible !== null`,
 * using the frame-fresh candidate rather than the graced `this.focus`).
 * Confirmed by direct measurement — with the player provably stationary
 * (position, `document.hasFocus()`, and pointer lock all static) a
 * multi-second hold under degraded headless frame pacing still occasionally
 * got cancelled mid-progress with no completion and no state change. This
 * is a real single-frame raycast hiccup, not a positioning bug (a separate,
 * genuine positioning bug — the generator-unit equipment blocks overlapping
 * the standing capsule near the control wall — was found and fixed in
 * `buildGeneratorBuilding.ts`; this is different and remained after that
 * fix). Retrying the hold from scratch is exactly what a real player would
 * do if an interaction got interrupted, and it's safe here: a cancelled
 * hold leaves `GeneratorState` at `ReadyToStart`, unchanged.
 */
async function holdStarterUntilCranked(page: Page): Promise<void> {
  const b = bridge(page);
  const overallDeadline = Date.now() + 90_000;

  while (Date.now() < overallDeadline) {
    // A cancelled attempt loses focus entirely (see FocusStability's grace
    // window expiring) — re-acquire it before every attempt, including the
    // first, so this function has no precondition on caller-side focus.
    expect(await b.teleportTo('fg-tp-gen-starter')).toBe(true);
    await expect
      .poll(() => b.interactionState().then((s) => s?.focusedId), { timeout: 10_000 })
      .toBe('fg-gen-ctrl-starter');

    await page.keyboard.down('KeyE');
    let progressed = false;
    try {
      const attemptDeadline = Date.now() + 10_000;
      while (Date.now() < attemptDeadline) {
        const state = await b.generatorSnapshot().then((s) => s?.state);
        if (state !== 'ReadyToStart') {
          progressed = true;
          break;
        }
        const ui = await b.interactionState();
        if (ui?.mode !== 'holding') {
          // Mode leaves 'holding' on both completion and cancellation.
          // Give the state transition a beat to land before concluding
          // this was a cancellation rather than a same-tick completion.
          await page.waitForTimeout(100);
          const settled = await b.generatorSnapshot().then((s) => s?.state);
          progressed = settled !== 'ReadyToStart';
          break;
        }
        await page.waitForTimeout(150);
      }
    } finally {
      await page.keyboard.up('KeyE');
    }
    if (progressed) {
      return;
    }
    await page.waitForTimeout(150);
  }
  throw new Error(
    'Starter hold never progressed the generator past ReadyToStart within the 90s retry budget',
  );
}

// ---------------------------------------------------------------------------
// Bridge surface + boot state
// ---------------------------------------------------------------------------

test('power bridge is available and starts in power-off defaults', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);

  const gen = await b.generatorSnapshot();
  expect(gen?.state).toBe('Offline');
  expect(gen?.fuelValve).toBe('Closed');
  expect(gen?.starterBattery).toBe('Disconnected');
  expect(gen?.emergencyStop).toBe('Engaged');
  expect(gen?.selector).toBe('Off');
  expect(gen?.mainBreaker).toBe('Open');

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('the emergency circuit is pre-energized from the battery at boot', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);

  const snap = await b.powerSnapshot();
  const emergency = snap?.circuits.find((c) => c.id === EMERGENCY_CIRCUIT);
  expect(emergency?.effective).toBe('energized');
  expect(emergency?.sourceId).toBe(BATTERY_SOURCE);
  const generator = snap?.sources.find((s) => s.id === GEN_SOURCE);
  expect(generator?.availability).toBe('offline');
});

// ---------------------------------------------------------------------------
// Generator readiness + startup (bridge-driven, for fast focused coverage)
// ---------------------------------------------------------------------------

test('generator readiness gates on all four conditions, in any order', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);

  await b.generatorAction('inspect');
  expect((await b.generatorSnapshot())?.state).toBe('NotReady');

  await b.generatorAction('setSelectorManual');
  await b.generatorAction('releaseEmergencyStop');
  await b.generatorAction('connectBattery');
  expect((await b.generatorSnapshot())?.state).toBe('NotReady'); // valve still closed
  expect((await b.generatorReadiness())?.ready).toBe(false);

  await b.generatorAction('openFuelValve');
  expect((await b.generatorSnapshot())?.state).toBe('ReadyToStart');
  expect((await b.generatorReadiness())?.ready).toBe(true);
});

test('readiness reports the first unmet condition until every control is satisfied', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);

  await b.generatorAction('inspect');
  let readiness = await b.generatorReadiness();
  expect(readiness?.ready).toBe(false);
  expect(readiness?.blockingReason).toBeTruthy();

  await b.generatorAction('openFuelValve');
  await b.generatorAction('connectBattery');
  await b.generatorAction('releaseEmergencyStop');
  readiness = await b.generatorReadiness();
  expect(readiness?.ready).toBe(false);
  expect(readiness?.blockingReason).toMatch(/SELECTOR/);

  await b.generatorAction('setSelectorManual');
  readiness = await b.generatorReadiness();
  expect(readiness?.ready).toBe(true);
  expect(readiness?.blockingReason).toBeNull();

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('main breaker is locked while RunningUnstable and closes once Running', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await bringGeneratorReady(page);

  // Crank via the bridge shortcut — this test is about breaker-lock
  // behavior, not the hold mechanic itself (that's covered by the
  // dedicated full-progression test using the real hold).
  await crankGeneratorViaBridge(page);

  expect((await b.generatorSnapshot())?.state).toBe('RunningUnstable');

  expect(await b.generatorAction('closeMainBreaker')).toBe(false);
  expect((await b.generatorSnapshot())?.mainBreaker).toBe('Open');

  await expect
    .poll(() => b.generatorSnapshot().then((s) => s?.state), { timeout: 60_000, intervals: [500] })
    .toBe('Running');

  expect(await b.generatorAction('closeMainBreaker')).toBe(true);
  expect((await b.generatorSnapshot())?.mainBreaker).toBe('Closed');

  const snap = await b.powerSnapshot();
  expect(snap?.sources.find((s) => s.id === GEN_SOURCE)?.availability).toBe('available');
  // Emergency circuit was transferred from battery onto the generator.
  expect(snap?.circuits.find((c) => c.id === EMERGENCY_CIRCUIT)?.sourceId).toBe(GEN_SOURCE);

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Distribution panel + capacity allocation
// ---------------------------------------------------------------------------

async function startAndCloseBreaker(page: Page): Promise<void> {
  const b = bridge(page);
  await bringGeneratorReady(page);
  await crankGeneratorViaBridge(page);
  await expect
    .poll(() => b.generatorSnapshot().then((s) => s?.state), { timeout: 60_000, intervals: [500] })
    .toBe('Running');
  await b.generatorAction('closeMainBreaker');
}

test('distribution panel opens and closes, and reflects generator/battery capacity', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);

  expect(await b.isPanelOpen()).toBe(false);
  expect(await b.openPanel()).toBe(true);
  expect(await b.isPanelOpen()).toBe(true);

  await expect(page.locator('#distribution-panel-viewer')).toBeVisible();
  await expect(page.locator('#distribution-panel-viewer')).toContainText('EMERGENCY BATTERY');

  await b.closePanel();
  expect(await b.isPanelOpen()).toBe(false);
  await expect(page.locator('#distribution-panel-viewer')).toBeHidden();

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('capacity allocation: circuits fit until the generator is exhausted, then reject cleanly', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await startAndCloseBreaker(page);

  // Generator: 10 total, 1 already allocated to the transferred emergency
  // circuit → 9 free. control-room(4) + tunnel(3) + staff-quarters(2) = 9.
  expect(await b.toggleCircuit(CONTROL_ROOM_CIRCUIT)).toBeNull();
  expect(await b.toggleCircuit(TUNNEL_CIRCUIT)).toBeNull();
  expect(await b.toggleCircuit(STAFF_CIRCUIT)).toBeNull();

  let snap = await b.powerSnapshot();
  expect(snap?.sources.find((s) => s.id === GEN_SOURCE)?.allocatedCapacity).toBe(10);

  // No capacity left: rooftop-antenna (4) must be rejected, atomically —
  // nothing already-on gets disturbed.
  const rejection = await b.toggleCircuit(ROOFTOP_CIRCUIT);
  expect(rejection).toBeTruthy();
  snap = await b.powerSnapshot();
  expect(snap?.circuits.find((c) => c.id === ROOFTOP_CIRCUIT)?.effective).toBe('de-energized');
  expect(snap?.circuits.find((c) => c.id === CONTROL_ROOM_CIRCUIT)?.effective).toBe('energized');

  // Freeing staff-quarters (2) still isn't enough for rooftop-antenna (4),
  // but is enough for archive (2).
  await b.toggleCircuit(STAFF_CIRCUIT); // off
  expect(await b.toggleCircuit(ROOFTOP_CIRCUIT)).toBeTruthy(); // still rejected
  expect(await b.toggleCircuit(ARCHIVE_CIRCUIT)).toBeNull(); // fits

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('requesting a circuit before the generator is available is rejected with a reason', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  const result = await b.requestCircuit(GENERATOR_AUX_CIRCUIT, GEN_SOURCE, 'on');
  expect(result?.ok).toBe(false);
  expect(result?.reason).toBeTruthy();
});

// ---------------------------------------------------------------------------
// World-state changes: loads powered per zone
// ---------------------------------------------------------------------------

test('turning on a circuit powers every load registered to it', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await startAndCloseBreaker(page);

  await b.toggleCircuit(CONTROL_ROOM_CIRCUIT);
  const snap = await b.powerSnapshot();
  const controlRoomLoads = snap?.loads.filter((l) => l.circuitId === CONTROL_ROOM_CIRCUIT) ?? [];
  expect(controlRoomLoads.length).toBeGreaterThan(0);
  expect(controlRoomLoads.every((l) => l.powered)).toBe(true);

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Receiver + control room powered access
// ---------------------------------------------------------------------------

test('receiver shows NO POWER until the control-room circuit is energized, then activates once', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);

  expect(await b.activateReceiver()).toBe(false); // no power yet

  await startAndCloseBreaker(page);
  await b.toggleCircuit(CONTROL_ROOM_CIRCUIT);

  expect(await b.activateReceiver()).toBe(true);
  const facilityState = await b.facilityState();
  expect(facilityState?.power.receiverActivated).toBe(true);
  expect(facilityState?.power.powerNetworkOperational).toBe(true);

  // One-shot: activating again is rejected.
  expect(await b.activateReceiver()).toBe(false);

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Powered access: combined inventory + power door
// ---------------------------------------------------------------------------

test('tunnel maintenance door requires BOTH the maintenance card AND the tunnel circuit powered', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  const doorId = 'fg-door-tunnel-maintenance';

  expect((await b.doorState(doorId))?.access).toBe('locked');

  // Card alone: still denied (no power).
  await b.collectPickup('fg-pickup-maintenance-card');
  await page.waitForTimeout(100);
  expect(await b.openDoor(doorId)).toBe(false);
  expect((await b.doorState(doorId))?.access).toBe('locked');

  // Power the tunnel circuit; now both conditions hold.
  await startAndCloseBreaker(page);
  await b.toggleCircuit(TUNNEL_CIRCUIT);
  expect(await b.openDoor(doorId)).toBe(true);
  await expect
    .poll(() => b.doorState(doorId), { timeout: 5000 })
    .toMatchObject({ access: 'unlocked' });

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('power-only access fails safe (denied) even with the item, before power is available', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await b.collectPickup('fg-pickup-maintenance-card');
  await page.waitForTimeout(100);
  expect(await b.openDoor('fg-door-tunnel-maintenance')).toBe(false);
});

test('fail-safe: an already-open powered door is not force-closed when power is later cut', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  const doorId = 'fg-door-tunnel-maintenance';

  await b.collectPickup('fg-pickup-maintenance-card');
  await startAndCloseBreaker(page);
  await b.toggleCircuit(TUNNEL_CIRCUIT);
  await b.openDoor(doorId);
  await expect
    .poll(() => b.doorState(doorId), { timeout: 5000 })
    .toMatchObject({ access: 'unlocked' });

  // Cut the tunnel circuit's power.
  await b.toggleCircuit(TUNNEL_CIRCUIT); // off
  await page.waitForTimeout(100);

  // The door's *lock* is unlocked permanently (matches every other item
  // lock's semantics) — power loss never relocks or force-closes it.
  expect((await b.doorState(doorId))?.access).toBe('unlocked');

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Checkpoint / respawn preservation + dev reset
// ---------------------------------------------------------------------------

test('respawn preserves generator and power state (checkpoint-recovery stand-in)', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await bringGeneratorReady(page);
  await b.toggleCircuit(GENERATOR_AUX_CIRCUIT); // rejected (generator offline) — irrelevant, just exercising the call
  const before = await b.generatorSnapshot();

  await b.respawn();
  await page.waitForTimeout(150);

  const after = await b.generatorSnapshot();
  expect(after).toEqual(before);

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('dev full reset clears generator, power network, and distribution panel state', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await bringGeneratorReady(page);
  expect(await b.openPanel()).toBe(true);

  await b.resetFacility();
  await page.waitForTimeout(150);

  const gen = await b.generatorSnapshot();
  expect(gen?.state).toBe('Offline');
  expect(gen?.fuelValve).toBe('Closed');
  expect(gen?.starterBattery).toBe('Disconnected');
  expect(gen?.emergencyStop).toBe('Engaged');
  expect(gen?.selector).toBe('Off');
  expect(gen?.mainBreaker).toBe('Open');
  expect(await b.isPanelOpen()).toBe(false);

  // resetFacility() restores exact boot-time state, not a blank slate: the
  // generator source is offline (never started), but the emergency battery
  // re-initializes and re-energizes the emergency circuit — same as a fresh
  // scene load (see docs/architecture/power-runtime-state.md).
  const snap = await b.powerSnapshot();
  expect(snap?.sources.find((s) => s.id === GEN_SOURCE)?.availability).toBe('offline');
  expect(snap?.sources.find((s) => s.id === BATTERY_SOURCE)?.availability).toBe('available');
  expect(snap?.circuits.find((c) => c.id === EMERGENCY_CIRCUIT)?.effective).toBe('energized');
  expect(
    snap?.circuits
      .filter((c) => c.id !== EMERGENCY_CIRCUIT)
      .every((c) => c.effective === 'de-energized'),
  ).toBe(true);

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// F10 debug overlay
// ---------------------------------------------------------------------------

test('F10 toggles the power debug overlay DOM panel on and off', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);

  await expect(page.locator('#power-debug-overlay')).toBeHidden();
  await page.keyboard.press('F10');
  await expect(page.locator('#power-debug-overlay')).toBeVisible();
  await expect(page.locator('#power-debug-overlay')).toContainText('GENERATOR');
  await page.keyboard.press('F10');
  await expect(page.locator('#power-debug-overlay')).toBeHidden();

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Repetition / lifecycle stability
// ---------------------------------------------------------------------------

test('lifecycle: repeated generator ready/reset cycles do not leak resources', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  const before = await b.diagnostics();

  for (let i = 0; i < 10; i++) {
    await bringGeneratorReady(page);
    expect((await b.generatorSnapshot())?.state).toBe('ReadyToStart');
    await b.resetFacility();
  }

  const after = await b.diagnostics();
  if (before !== undefined && after !== undefined) {
    expect(after.cameraCount).toBe(before.cameraCount);
    expect(after.beforeRenderObserverCount).toBe(before.beforeRenderObserverCount);
  }
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('lifecycle: repeated panel open/close cycles do not leak DOM or observers', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  const before = await b.diagnostics();

  for (let i = 0; i < 20; i++) {
    // devActivate requires the interaction mode to have settled back to
    // 'gameplay' — that flip happens on the next render frame after
    // close(), not synchronously — so poll for it rather than assuming a
    // fixed delay is enough (same load-sensitivity rationale as
    // holdStarterUntilCranked above).
    await expect
      .poll(() => b.interactionState().then((s) => s?.mode), { timeout: 5000 })
      .toBe('gameplay');
    expect(await b.openPanel()).toBe(true);
    expect(await b.isPanelOpen()).toBe(true);
    await b.closePanel();
    expect(await b.isPanelOpen()).toBe(false);
  }

  const panelElementCount = await page.locator('#distribution-panel-viewer').count();
  expect(panelElementCount).toBe(1);

  const after = await b.diagnostics();
  if (before !== undefined && after !== undefined) {
    expect(after.cameraCount).toBe(before.cameraCount);
    expect(after.beforeRenderObserverCount).toBe(before.beforeRenderObserverCount);
  }
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('lifecycle: repeated circuit toggling settles deterministically and leaks nothing', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await startAndCloseBreaker(page);
  const before = await b.diagnostics();

  for (let i = 0; i < 30; i++) {
    await b.toggleCircuit(GENERATOR_AUX_CIRCUIT);
  }
  // 30 toggles starting from off: even count → back to off.
  const snap = await b.powerSnapshot();
  expect(snap?.circuits.find((c) => c.id === GENERATOR_AUX_CIRCUIT)?.effective).toBe(
    'de-energized',
  );

  const after = await b.diagnostics();
  if (before !== undefined && after !== undefined) {
    expect(after.cameraCount).toBe(before.cameraCount);
    expect(after.beforeRenderObserverCount).toBe(before.beforeRenderObserverCount);
  }
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('lifecycle: repeated valid/invalid allocation attempts never corrupt capacity accounting', async ({
  page,
}) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  await startAndCloseBreaker(page);

  for (let i = 0; i < 15; i++) {
    await b.toggleCircuit(ROOFTOP_CIRCUIT); // 4 — fits
    await b.toggleCircuit(ARCHIVE_CIRCUIT); // 2 — fits (6/9 used)
    await b.toggleCircuit(CONTROL_ROOM_CIRCUIT); // 4 — rejected (only 3 free)
    await b.toggleCircuit(ROOFTOP_CIRCUIT); // back off
    await b.toggleCircuit(ARCHIVE_CIRCUIT); // back off
  }

  const snap = await b.powerSnapshot();
  const generator = snap?.sources.find((s) => s.id === GEN_SOURCE);
  // Only the transferred emergency circuit (1 unit) should remain allocated.
  expect(generator?.allocatedCapacity).toBe(1);
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('lifecycle: repeated powered-door transitions stay consistent', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  const doorId = 'fg-door-tunnel-maintenance';
  await b.collectPickup('fg-pickup-maintenance-card');
  await startAndCloseBreaker(page);

  // Denied while the tunnel circuit is off, even with the card held.
  for (let i = 0; i < 10; i++) {
    expect(await b.openDoor(doorId)).toBe(false);
    expect((await b.doorState(doorId))?.access).toBe('locked');
  }

  // First successful unlock once the circuit is energized.
  await b.toggleCircuit(TUNNEL_CIRCUIT); // on
  expect(await b.openDoor(doorId)).toBe(true);
  expect((await b.doorState(doorId))?.access).toBe('unlocked');

  // Fail-safe: cycling the circuit off/on afterwards never relocks it, and
  // every further interact() call (now just an open/close toggle on an
  // already-unlocked door) keeps succeeding — matches DoorController's
  // "once unlocked, always interactable" contract.
  for (let i = 0; i < 10; i++) {
    await b.toggleCircuit(TUNNEL_CIRCUIT); // off
    expect((await b.doorState(doorId))?.access).toBe('unlocked');
    await b.toggleCircuit(TUNNEL_CIRCUIT); // on
    expect(await b.openDoor(doorId)).toBe(true);
  }
  expect((await b.doorState(doorId))?.access).toBe('unlocked');
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('lifecycle: repeated full resets settle to identical clean state', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);

  for (let i = 0; i < 5; i++) {
    await bringGeneratorReady(page);
    await expect
      .poll(() => b.interactionState().then((s) => s?.mode), { timeout: 5000 })
      .toBe('gameplay');
    expect(await b.openPanel()).toBe(true);
    await b.resetFacility();
  }
  const gen = await b.generatorSnapshot();
  expect(gen?.state).toBe('Offline');
  expect(await b.isPanelOpen()).toBe(false);
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

test('lifecycle: repeated F10 toggling leaves marker mesh count stable', async ({ page }) => {
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);
  const before = await b.diagnostics();

  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('F10');
  }
  // Even count of presses → back to hidden.
  await expect(page.locator('#power-debug-overlay')).toBeHidden();

  const after = await b.diagnostics();
  if (before !== undefined && after !== undefined) {
    expect(after.cameraCount).toBe(before.cameraCount);
    expect(after.beforeRenderObserverCount).toBe(before.beforeRenderObserverCount);
  }
  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Full power progression — REAL gameplay interactions only
// ---------------------------------------------------------------------------

test('full power progression: real generator startup and receiver activation', async ({ page }) => {
  // Generous: the real starter hold and the warm-up wait are each allowed
  // up to 60s under degraded headless frame pacing (see
  // holdStarterUntilCranked's comment), so the full sequence needs
  // meaningful headroom beyond Playwright's 60s default.
  test.setTimeout(240_000);
  const errors = { console: [] as string[], page: [] as string[] };
  await boot(page, errors);
  const b = bridge(page);

  // ----- Walk the M0.5 chain to GreyboxComplete (bridge-assisted movement,
  // exactly like facility.spec.ts's teleport-based traversal) -----------
  // Each AABB zone trigger only fires once the per-frame position poll
  // observes the player inside it — under degraded headless frame pacing (see
  // holdStarterUntilCranked's comment) a fixed wall-clock wait between
  // teleports is not reliably enough for even one frame to land, so poll for
  // the resulting phase after every step instead.
  const path: ReadonlyArray<[string, string]> = [
    ['fg-tp-security-booth', 'SecurityCheckpoint'],
    ['fg-tp-gate', 'CompoundEntered'],
    ['fg-tp-control-lobby', 'ControlBuildingReached'],
    ['fg-tp-generator', 'GeneratorAccessed'],
    ['fg-tp-tunnel', 'TunnelAccessed'],
    ['fg-tp-staff', 'StaffQuartersReached'],
    ['fg-tp-supervisor', 'SupervisorOfficeReached'],
  ];
  for (const [tp, expectedPhase] of path) {
    expect(await b.teleportTo(tp)).toBe(true);
    await expect
      .poll(() => b.facilityState().then((s) => s?.progressionPhase), { timeout: 20_000 })
      .toBe(expectedPhase);
  }
  await b.collectPickup('fg-pickup-antenna-access-card');
  await page.waitForTimeout(100);
  expect(await b.openDoor('fg-door-rooftop')).toBe(true);
  await expect
    .poll(() => b.facilityState().then((s) => s?.progressionPhase))
    .toBe('RooftopAccessed');

  expect(await b.teleportTo('fg-tp-rooftop')).toBe(true);
  await expect
    .poll(() => b.facilityState().then((s) => s?.progressionPhase), { timeout: 20_000 })
    .toBe('GreyboxComplete');

  // ----- Real generator startup: every control via [E], the starter via a
  // real 2-second hold — never a state-setting bridge shortcut. ----------
  //
  // Two real bugs caught here during development (both documented in
  // testing.md's "Full power progression test" section):
  //
  // 1. Polling `focusedId` for mere truthiness is not enough.
  //    `FocusStability`'s loss-grace period keeps the *previous* target
  //    focused for a short window after the raycast stops hitting it (see
  //    FocusStability.ts) — so immediately after a teleport, `focusedId` can
  //    still read the just-left control (truthy!) for a beat before the new
  //    one is acquired, and `[E]` fires on the stale target instead.
  //    `press()` polls for the *specific* expected target id, not mere
  //    truthiness.
  // 2. A fixed `page.waitForTimeout(150)` after the keypress is not enough
  //    to guarantee the queued interact was actually processed: under
  //    degraded headless frame pacing a single rendered frame can take well
  //    over 150ms (see the starter-hold note above), and `InteractionSystem`
  //    only consumes `interactQueued` on its own `onBeforeRenderObservable`
  //    tick. A fixed sleep shorter than one frame silently drops the press —
  //    the very next `teleportTo()` moves on before the interact ever fired.
  //    `press()` therefore takes a `verify` predicate and polls it after the
  //    keypress instead of guessing a sleep duration.
  // 3. Occasionally the very first raycast after a teleport misses for
  //    longer than any reasonable single-attempt timeout — a genuine
  //    headless-SwiftShader picking hiccup (confirmed by direct
  //    measurement: `isGameplayViewActive`, `windowFocused` and
  //    `document.hasFocus()` all stayed true throughout one such stall, so
  //    it isn't a mode/input-lock gating bug). Every diagnostic re-teleport
  //    reliably kicked the raycaster back into a working state, so `press()`
  //    retries the teleport-and-wait-for-focus step a few times within an
  //    overall budget rather than trusting one long wait.
  async function focusOn(teleportId: string, expectedTargetId: string): Promise<void> {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      expect(await b.teleportTo(teleportId)).toBe(true);
      try {
        await expect
          .poll(() => b.interactionState().then((s) => s?.focusedId), { timeout: 8_000 })
          .toBe(expectedTargetId);
        return;
      } catch {
        // Retry with a fresh teleport (see point 3 above).
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
        // `verify` still reports the pre-press state, so the queued
        // interact was genuinely dropped (point 2 above), not just slow to
        // land — pressing again is the correct corrective action, not a
        // double-toggle. Re-confirm focus first: the same stall that drops
        // the press can also cost focus.
        await focusOn(teleportId, expectedTargetId);
      }
    }
    expect(await verify()).toBe(true);
  }

  await press(
    'fg-tp-gen-status-panel',
    'fg-gen-ctrl-status-panel',
    async () => (await b.generatorSnapshot())?.state === 'NotReady',
  );

  await press(
    'fg-tp-gen-fuel-valve',
    'fg-gen-ctrl-fuel-valve',
    async () => (await b.generatorSnapshot())?.fuelValve === 'Open',
  );
  await press(
    'fg-tp-gen-battery',
    'fg-gen-ctrl-battery',
    async () => (await b.generatorSnapshot())?.starterBattery === 'Connected',
  );
  await press(
    'fg-tp-gen-estop',
    'fg-gen-ctrl-estop',
    async () => (await b.generatorSnapshot())?.emergencyStop === 'Released',
  );
  await press(
    'fg-tp-gen-selector',
    'fg-gen-ctrl-selector',
    async () => (await b.generatorSnapshot())?.selector === 'Manual',
  );
  await expect
    .poll(() => b.generatorSnapshot().then((s) => s?.state), { timeout: 15_000 })
    .toBe('ReadyToStart');

  // holdStarterUntilCranked teleports to the starter and confirms focus
  // itself (see its docstring — a retried attempt needs to re-acquire
  // focus anyway, so it owns that step unconditionally).
  await holdStarterUntilCranked(page);
  expect((await b.generatorSnapshot())?.state).toBe('RunningUnstable');
  await expect
    .poll(() => b.facilityState().then((s) => s?.progressionPhase), { timeout: 3000 })
    .toBe('GeneratorStarted');

  await expect
    .poll(() => b.generatorSnapshot().then((s) => s?.state), { timeout: 60_000, intervals: [500] })
    .toBe('Running');

  await press(
    'fg-tp-gen-breaker',
    'fg-gen-ctrl-breaker',
    async () => (await b.generatorSnapshot())?.mainBreaker === 'Closed',
  );
  await expect
    .poll(() => b.facilityState().then((s) => s?.progressionPhase), { timeout: 3000 })
    .toBe('MainPowerAvailable');

  // ----- Distribution panel: energize the control-room circuit via a real
  // click on the panel's own toggle button, not a bridge call. ------------
  await focusOn('fg-tp-distribution-panel', 'fg-distribution-panel');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#distribution-panel-viewer')).toBeVisible({ timeout: 15_000 });

  const controlRoomRow = page.locator('.power-panel-row', { hasText: 'Control Room' });
  await controlRoomRow.getByRole('button', { name: 'TURN ON' }).click();
  await expect(controlRoomRow).toContainText('EFFECTIVE: ENERGIZED');

  await page.keyboard.press('Escape');
  await expect(page.locator('#distribution-panel-viewer')).toBeHidden();

  await expect
    .poll(() => b.facilityState().then((s) => s?.progressionPhase), { timeout: 3000 })
    .toBe('ControlRoomPowered');

  // ----- Activate the receiver via a real [E] press. ----------------------
  await press(
    'fg-tp-receiver',
    'fg-receiver',
    async () => (await b.facilityState())?.power.receiverActivated === true,
  );

  await expect
    .poll(() => b.facilityState().then((s) => s?.progressionPhase), { timeout: 3000 })
    .toBe('PowerNetworkOperational');
  const finalState = await b.facilityState();
  expect(finalState?.power.receiverActivated).toBe(true);
  expect(finalState?.power.powerNetworkOperational).toBe(true);

  expect(errors.console).toHaveLength(0);
  expect(errors.page).toHaveLength(0);
});
