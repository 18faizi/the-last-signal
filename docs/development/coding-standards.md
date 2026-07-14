# Coding standards

## TypeScript

- Strict mode plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`. Do not weaken `tsconfig.json`.
- `any` is banned (lint error). If an external package has incomplete
  typings, isolate the workaround in one place and document why.
- No non-null assertions (`!`); narrow explicitly or use `requireElement`-style
  helpers that throw with a useful message.
- Public methods on services declare explicit return types
  (`explicit-module-boundary-types` is a lint error).
- Prefer string literal unions over enums for values that appear in state
  or logs (`SceneId`, `LifecycleState`); enums are fine for action-style
  identifiers (`InputAction`).

## Architecture

- Small, focused modules; one responsibility per service.
- Composition over inheritance; no base classes without at least two real
  implementations needing shared behavior.
- Dependencies arrive via constructors or `ApplicationContext` — never via
  imports of mutable singletons or hidden service locators.
- No circular dependencies. `core/*` modules must not import from `app/`
  or `scenes/`.
- Babylon-specific code stays out of `state/` and `config/`.

## Cleanup discipline

Anything that registers a browser listener, engine observer, interval or
store subscription either implements `Disposable` or registers a cleanup
callback in a `DisposableBag`. If you add a listener without a matching
disposal path, it is a bug.

## Comments

Comments explain _reasoning_ (why this order, why this workaround), not what
the next line does. Do not leave TODOs for functionality the current
milestone requires; do not leave dead code.

## Linting/formatting

- `pnpm lint` and `pnpm format:check` must pass; rules are not suppressed
  without a justifying comment.
- Prettier owns formatting; do not hand-format against it.
