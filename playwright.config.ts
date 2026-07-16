import { defineConfig, devices } from '@playwright/test';

const PORT = 5199;

// Sandboxed dev environments ship a pre-installed Chromium that may not
// match this Playwright version's expected build; point at it explicitly
// via env instead of downloading. CI installs the matching browser and
// leaves this unset.
const chromiumExecutable = process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  // Movement tests assert physics timing; parallel browsers on software
  // rendering (SwiftShader) contend for CPU and skew frame pacing.
  workers: 1,
  // One retry everywhere: physics-timing assertions on SwiftShader are
  // sensitive to host load, and a genuine regression still fails twice.
  retries: 1,
  reporter: process.env['CI'] ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // Headless Chromium has no GPU; SwiftShader provides a software
          // WebGL implementation so the Babylon WebGL fallback can start.
          args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
          ...(chromiumExecutable !== undefined && { executablePath: chromiumExecutable }),
        },
      },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
