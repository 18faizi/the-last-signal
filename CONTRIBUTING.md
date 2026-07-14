# Contributing

## Workflow

1. Create a feature branch.
2. Make focused changes; keep milestone scope boundaries intact.
3. Run `pnpm check` (format, lint, typecheck, unit tests, build) and
   `pnpm test:e2e` before pushing.
4. Open a pull request; CI runs the same checks.

## Standards

Read `docs/development/coding-standards.md` before contributing. In short:

- Strict TypeScript; no `any`, no non-null assertions, explicit public types.
- Small focused modules; dependencies injected via constructors or the
  application context — no globals, no service locators.
- Everything that registers a listener/observer/interval must implement or
  register disposal (`Disposable` / `DisposableBag`).
- Babylon objects never go into Zustand stores.
- No binary assets in the repository.
- Comments explain reasoning, not syntax.

## Tests

New logic that can run without a renderer gets a Vitest unit test in
`src/tests/unit/`. Browser-observable behavior belongs in the Playwright
suite in `tests/e2e/`. Do not add tests that merely restate the
implementation.
