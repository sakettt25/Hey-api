# Hey API

**Open-source, local-first API development and testing application.**

Hey API is a community-driven fork of Bruno, built for developers who want a fast, private, offline-capable API client with no mandatory accounts, no cloud sync, and no telemetry.

---

## Why Hey API?

| | Hey API | Postman |
|---|---|---|
| Runs fully offline | ✅ | ❌ requires account |
| Collections stored as local files | ✅ | ❌ cloud-first |
| No telemetry by default | ✅ | ❌ |
| Git-native version control | ✅ | limited |
| Free and open-source core | ✅ | ❌ |
| No mandatory AI API key | ✅ | — |

---

## Features

- **HTTP, gRPC, WebSocket, GraphQL** — all request types in one tool
- **Local file storage** — collections saved as `.nats` or `.yml` files you can commit to Git
- **Environments** — local, development, staging, production with secret masking
- **Pre/post-request scripts** — JavaScript sandbox (QuickJS for safe mode, Node VM for developer mode)
- **Assertions and tests** — request-level test blocks with Chai assertions
- **Collection runner** — run entire collections with iterations and data files
- **Import/export** — Postman, Insomnia, OpenAPI 3.x, WSDL
- **Built-in Git integration** — diff, commit, push without leaving the app
- **Mock server** — local mock for testing without a live backend
- **CLI runner** — same execution engine as the desktop app, for CI/CD pipelines
- **OpenAPI sync** — detect drift between your live spec and your collection
- **Integrated terminal** — shell access inside the app

---

## Installation

### Download

Builds for macOS (Intel + Apple Silicon), Windows (x64 + ARM), and Linux (AppImage, deb, rpm) are available from the [Releases](https://github.com/sakettt25/Hey-api/releases) page.

### Build from source

```sh
# Clone the repository
git clone https://github.com/sakettt25/Hey-api.git
cd Hey-api

# Install dependencies (Node.js 20+ required)
npm install

# Start the development build
npm run dev
```

### CLI

```sh
npm install -g @nats/cli

# Run a collection
nats run

# Run a specific request
nats run requests/my-request.nats

# Run against an environment
nats run --env staging
```

---

## Quick Start

1. Open Hey API.
2. Click **Open Collection** and select a folder containing `.nats` or `.yml` files, or create a new collection.
3. Add a request: right-click the collection → **New Request**.
4. Enter a URL, set headers and body as needed, and press **Send** (or `Cmd/Ctrl+Enter`).
5. Inspect the response in the panel below.

---

## Collections and Environments

Collections are directories on your filesystem. Each request is a `.nats` or `.yml` file you can read and edit in any text editor, diff in Git, and commit like any other source file.

Environments are stored in the `environments/` subdirectory of a collection. Secret variables are encrypted at rest using OS keychain (macOS/Windows) or AES-256 with a machine-derived key (Linux fallback). **Secrets are never written to disk in plain text and never exported unless you explicitly choose to include them.**

---

## Scripting

Pre-request and post-response scripts are JavaScript, executed in a sandboxed runtime.

```js
// Pre-request: set a dynamic header
bru.setRequestHeader('X-Timestamp', Date.now().toString());

// Post-response: extract and store a token
const token = res.getBody().access_token;
bru.setEnvVar('authToken', token);

// Test assertion
test('status is 200', () => {
  expect(res.getStatus()).to.equal(200);
});
```

Two sandbox modes are available per collection:

- **Safe (default)** — QuickJS WASM sandbox; no filesystem or network access from scripts
- **Developer** — Node.js VM context; can `require()` modules from the collection directory

---

## Authentication

Supported schemes: API Key, Bearer Token, Basic, Digest, NTLM, OAuth 1.0, OAuth 2.0 (all four grant types), AWS SigV4, WSSE, Akamai EdgeGrid.

---

## Import / Export

| Format | Import | Export |
|---|---|---|
| Postman Collection v2.1 | ✅ | ✅ |
| Insomnia v4 | ✅ | — |
| OpenAPI 3.x / Swagger 2.0 | ✅ | — |
| WSDL | ✅ | — |
| OpenCollection (YAML) | ✅ | ✅ |

---

## Privacy and Local-Only Guarantees

Hey API does not send any application traffic to remote servers during normal use.

- **No telemetry** — PostHog and all anonymous analytics have been removed.
- **No auto-update checks** — version updates require a deliberate user action.
- **No remote config** — feature flags and remote configuration services are not used.
- **No crash reporting** — error information stays on your machine.
- **No account required** — the application works fully offline without a user account.
- **No mandatory AI key** — AI features (if used) require explicit user configuration of a local or user-owned provider. No cloud AI call is made without explicit user action.

The only outbound network traffic from a running Hey API session is:

1. API requests **you** send to endpoints **you** configure.
2. OAuth 2.0 authorization flows **you** initiate.
3. OpenAPI sync checks to URLs **you** configure.

No other background network requests are made.

---

## Repository Structure

```
packages/
  app/          React renderer (rsbuild, Redux Toolkit, styled-components)
  electron/     Electron main process
  js/           JS sandbox runtime (QuickJS + Node VM)
  common/       Shared browser-safe utilities
  converters/   Import/export converters
  requests/     HTTP/gRPC/WebSocket request building blocks
  filestore/    .nats / .yml serialization
  sqlite/       Local SQLite storage (Node built-in node:sqlite)
  query/        JSONPath query engine
  lang/         Nats DSL grammar (ohm-js v2, arcsecond v1 legacy)
  schema/       Yup runtime validation
  schema-types/ TypeScript type definitions
  graphql-docs/ GraphQL documentation generator
  cli/          CLI runner
  tests/        Test servers for E2E fixtures
tests/          Playwright E2E test suite
playwright/     Test fixtures and helpers
```

---

## Build Commands

```sh
# Install all workspace dependencies
npm install

# Development (hot-reload)
npm run dev

# Build the React app only
npm run build:web

# Build all shared packages
npm run build:common
npm run build:requests
npm run build:filestore
npm run build:sqlite
npm run build:converters
npm run build:query

# Package the Electron app
npm run build:electron

# Run unit tests
npm test --workspace=packages/electron
npm test --workspace=packages/js

# Run E2E tests (requires a running app build)
npm run test:e2e

# Lint
npm run lint
```

---

## Contributing

Contributions are welcome. Please read [contributing.md](contributing.md) before opening a pull request.

When fixing a bug, include a test that reproduces the failure before the fix. When adding a feature, keep it behind a clearly named function and add documentation.

Do not introduce mandatory cloud services, telemetry, paid dependencies, or AI API keys as requirements for any core feature.

---

## Roadmap

Priorities in order:

1. Reliability — URL parsing edge cases, request cancellation, environment variable resolution
2. Git-native workflow improvements — cleaner diffs, conflict detection
3. Better debugging — response comparison, variable resolution inspector, assertion generator
4. Environment safety — production warnings, unresolved variable detection
5. Testing improvements — schema validation, local reports, mock server improvements

---

## License

MIT — see [license.md](license.md).

**Upstream attribution:**
Hey API is built upon [Bruno](https://github.com/usebruno/bruno), copyright © 2022 Anoop M D, Anusree P S and Contributors, licensed under MIT. The Bruno name and logo are trademarks of Anoop M D and are not used to represent this project.
