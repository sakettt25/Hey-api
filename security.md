# Security Policy

## Supported versions

Only the latest released version of Hey API receives security fixes.

## Reporting a vulnerability

Please do **not** open a public GitHub issue for security vulnerabilities.

Report security issues by emailing the maintainers directly or by opening a [GitHub Security Advisory](https://github.com/sakettt25/Hey-api/security/advisories/new) (private disclosure).

Include:
- A clear description of the vulnerability
- Steps to reproduce
- The potential impact
- Your suggested fix, if any

You will receive a response within 5 business days. If the issue is confirmed, a fix will be released as soon as practical, and you will be credited in the release notes unless you prefer otherwise.

## Security model

Hey API is a local-first desktop application. The relevant threat model:

### What Hey API protects

- **Secrets at rest** — environment variables marked as secrets are encrypted using Electron's `safeStorage` (OS keychain on macOS and Windows) or AES-256-CBC with a machine-derived key as fallback. Secrets are never written to disk in plain text.
- **Script sandbox** — user scripts run in either a QuickJS WASM sandbox (safe mode, no filesystem/network access from scripts) or a Node.js VM context (developer mode, restricted to the collection directory by default).
- **No application-owned remote servers** — Hey API does not route user requests through any proxy or relay server owned by the project. The only outbound traffic is user-initiated API calls.

### What Hey API does not protect against

- A malicious collection opened by the user (scripts execute with the permissions of the selected sandbox mode).
- Local filesystem access by other processes on the same machine.
- Compromised Node.js or Electron binaries.

### OAuth2 callback security

OAuth2 authorization callbacks use the `heyapi://` deep-link protocol. The application validates the `state` parameter on every callback to prevent CSRF and authorization code injection attacks.

## Dependency policy

- Runtime dependencies must be open-source and actively maintained.
- Pinned versions are used for critical dependencies (see `package.json` `overrides`).
- `npm audit` is run in CI. High and critical advisories block merges.
