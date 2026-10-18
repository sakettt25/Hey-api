# Contributing to Hey API

Thanks for your interest in contributing. This document covers how to get set up, the conventions to follow, and what to expect from the review process.

---

## Non-negotiable principles

Before contributing, understand the product constraints:

- **Local-first, always.** No feature may require a user account, cloud service, hosted backend, or mandatory network call to Hey API–owned infrastructure.
- **No telemetry.** Do not add analytics, crash reporters, usage counters, or remote logging of any kind.
- **No mandatory AI keys.** AI features are optional. No core feature may depend on an external LLM.
- **No paid dependencies.** All runtime dependencies must be available under an open-source license.
- **No destructive changes to user data.** Never delete or overwrite collection files, environments, or credentials without explicit user action.

---

## Development setup

### Requirements

- Node.js 20 or later
- npm 10 or later
- Windows, macOS, or Linux

### Install

```sh
git clone https://github.com/sakettt25/Hey-api.git
cd hey-api
npm install
```

### Build shared packages first

Some packages emit `dist/` artifacts that others depend on:

```sh
npm run build:bruno-common
npm run build:bruno-requests
npm run build:bruno-filestore
npm run build:bruno-sqlite
npm run build:bruno-converters
npm run build:bruno-query
npm run build:schema-types
npm run build:graphql-docs
```

### Start development

```sh
npm run dev
```

This launches Electron with hot-reload for the renderer.

---

## Project structure

```
packages/
  bruno-app/        React UI (rsbuild, Redux Toolkit, styled-components)
  bruno-electron/   Electron main process and IPC handlers
  bruno-js/         JavaScript sandbox (QuickJS + Node VM)
  bruno-common/     Browser-safe shared utilities (no Node APIs)
  bruno-converters/ Import/export: Postman, Insomnia, OpenAPI, WSDL
  bruno-requests/   HTTP/gRPC/WebSocket request building blocks
  bruno-filestore/  .bru and .yml file format serialization
  bruno-sqlite/     Local SQLite storage (node:sqlite, main process only)
  bruno-query/      JSONPath query engine
  bruno-lang/       Bru DSL grammar (ohm-js v2)
  bruno-schema/     Runtime validation (Yup)
  bruno-schema-types/ TypeScript types only
  bruno-graphql-docs/ GraphQL documentation generator
  bruno-cli/        CLI runner
  bruno-tests/      Express test servers for E2E fixtures
tests/              Playwright E2E test suite
playwright/         E2E fixtures and page helpers
```

---

## Dependency rules

The internal package dependency graph is a strict DAG. Do not add circular or upward dependencies.

- `bruno-common` must stay browser-safe. No Node.js builtins.
- `bruno-js` must not import from `bruno-electron`. It runs in both the desktop app and the CLI.
- `bruno-sqlite` is main-process only. Never import it from the renderer or `bruno-js`.
- `bruno-schema-types` is types-only. No runtime imports.
- Never import `bruno-app` or `bruno-electron` from any shared package.

---

## Making changes

### Small fixes
Open a PR directly. Keep the diff focused — one concern per PR.

### New features
Open an issue first to discuss the approach, especially if it touches:
- File formats (`.bru` or `.yml`) — format changes require the DSL rules in `.claude/rules/dsl-changes.md`
- IPC — see `.claude/rules/electron-ipc.md`
- Redux store — see `.claude/rules/redux-store.md`
- SQLite schema — see `.claude/rules/sqlite.md`

### Bug fixes
Reproduce the bug with a test first, then fix it. If you can't write a test before the fix (e.g., Electron-specific behaviour), document why in the PR.

---

## Tests

Run unit tests:

```sh
# Bruno-electron unit tests
cd packages/electron
node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --forceExit

# JS sandbox tests
cd packages/js
node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --forceExit

# Converter tests
cd packages/converters
node ../../node_modules/jest/bin/jest.js
```

Run E2E tests (requires app build and Playwright):

```sh
npm run test:e2e
```

### Rules for tests

- Test observable behaviour, not implementation details.
- Each test must be independent — no shared mutable state between tests.
- No hardcoded timeouts. Use Playwright's built-in `waitFor*` APIs.
- New behaviour must have a new test. Bug fixes must have a regression test.
- Do not delete tests because they fail after your change — fix the behaviour instead.

---

## Code style

- 2-space indentation, single quotes, semicolons.
- No `cloneDeep` in new code — copy only what will be mutated, as shallowly as possible.
- No `useEffect` unless absolutely necessary — prefer derived state and event handlers.
- React hooks must be imported directly (`import { useState } from 'react'`), not accessed as `React.useState`.
- Styled Components handle colours, Tailwind handles layout.
- See `CODING_STANDARDS.md` for the full style guide.

---

## Pull request checklist

Before submitting:

- [ ] Relevant unit tests pass locally
- [ ] No new mandatory network calls to Hey API–owned servers
- [ ] No new telemetry, analytics, or crash reporting
- [ ] No new paid dependencies
- [ ] If the change touches a file format, DSL, or IPC channel, the change is documented
- [ ] The PR description explains what changed and why

---

## Upstream attribution

Hey API is built upon [Bruno](https://github.com/usebruno/bruno) by Anoop M D, Anusree P S and Contributors (MIT). The Bruno name, logo, and trademark belong to Anoop M D and are not used to represent this project. See `license.md` for the full upstream attribution.
