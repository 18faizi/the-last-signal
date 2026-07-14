# Local setup

## Prerequisites

- Node.js >= 20 (Node 22 recommended; CI uses 22)
- pnpm 10 — `corepack enable` activates the version pinned in
  `package.json` (`packageManager` field)

## First run

```bash
pnpm install
pnpm dev
```

Vite prints a local URL. Opening it should show the loading screen, then the
development scene with a falling sphere and the
`Milestone 0.1 — Foundation Ready` marker.

## Useful commands

| Command           | Purpose                                          |
| ----------------- | ------------------------------------------------ |
| `pnpm dev`        | dev server with HMR                              |
| `pnpm build`      | production build to `dist/`                      |
| `pnpm preview`    | serve the production build locally               |
| `pnpm check`      | format check, lint, typecheck, unit tests, build |
| `pnpm test:watch` | unit tests in watch mode                         |
| `pnpm test:e2e`   | Playwright smoke test                            |

## Playwright browsers

`pnpm test:e2e` needs a Chromium matching the installed Playwright version:

```bash
pnpm exec playwright install chromium
```

In sandboxed environments with a pre-installed Chromium, point the config at
it instead of downloading:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chrome pnpm test:e2e
```

## WebGPU vs WebGL locally

The engine tries WebGPU first and logs the chosen backend to the console in
development. To force the WebGL path for testing, disable WebGPU in your
browser (e.g. chrome://flags) — the app must behave identically apart from
the backend line in the debug overlay.
