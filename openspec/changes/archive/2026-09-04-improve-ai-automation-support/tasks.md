## 1. Control Contract Foundation

- [x] 1.1 Add Zod 4 and `zod-openapi` as direct production dependencies without reverting unrelated package updates, create the control module skeleton, and verify `pnpm install --lockfile-only` plus `pnpm run type-check` succeed.
- [x] 1.2 Define strict request, response, metadata, error, table, configuration, lifecycle, log and client schemas as the runtime source of truth, and verify schema unit tests cover valid data, unknown fields, limits and boundary failures.
- [x] 1.3 Implement stable control errors and HTTP status mapping for malformed JSON, validation, authentication, not found, conflict and unavailable cases, and verify unit tests assert the documented English codes/messages and optional field issues.
- [x] 1.4 Generate the OpenAPI document from the runtime schemas with all v1 paths and security declarations, and verify an OpenAPI test parses the result and compares every implemented method/path against the route contract.

## 2. Engine State and Log Semantics

- [x] 2.1 Extend engine logs with instance-monotonic IDs, `system` type and `api` source while keeping chronological storage, and verify unit tests cover ordering, capacity eviction and source tagging.
- [x] 2.2 Implement cursor/filter log queries and clear-without-ID-reset behavior, and verify tests cover `afterId`, `limit`, type/source filters, `nextAfterId`, `droppedBeforeId` and an empty result immediately after clear.
- [x] 2.3 Add an instance-level selective state reset that does not destroy the singleton, configuration or client connections, and verify engine tests cover all-table defaults, selected tables and optional log clearing.
- [x] 2.4 Implement bounded range reads and prevalidated atomic range writes for all four tables, and verify tests prove correct boundary reads, strict booleans/16-bit integers, the 1000-value limit and zero partial mutation on failure.
- [x] 2.5 Refactor existing register encoding behind the control service for UInt, Int, Float, Double and hex byte writes without renaming public data types, and verify encoding tests cover byte/word orders, overflow, invalid inputs and atomic boundary failures.

## 3. Runtime Lifecycle Coordination

- [x] 3.1 Implement a `globalThis`-backed RuntimeCoordinator with stable instance identity, desired configuration, per-transport state and a serialized transition queue, and verify unit tests cover HMR reuse, idempotent concurrent startup and ordered overlapping transitions.
- [x] 3.2 Update TCP lifecycle reporting to enter running only after listener initialization and error on bind failure, and verify focused tests cover initialized, serverError, stop and occupied-port paths.
- [x] 3.3 Update RTU lifecycle reporting to distinguish disabled, starting, running, stopping and error from actual serial open/close outcomes, and verify focused tests cover no-path, successful open, open failure and stop paths.
- [x] 3.4 Route `ensureServersStarted()` and `instrumentation.register()` through the coordinator while retaining module-level idempotent startup calls in v1 routes, and verify startup tests show one server per transport and a usable degraded Dashboard after transport failure.
- [x] 3.5 Implement serialized config PATCH application with affected-transport restarts, explicit effects and desired-state retention on failure, and verify tests cover log-only changes, TCP/RTU-specific changes, disconnected TCP clients and failed bind without rollback.
- [x] 3.6 Emit secret-free system lifecycle logs for start, stop, successful reconfiguration and failures, and verify log tests correlate state transitions while asserting configured Token text is absent.

## 4. API Security and v1 Routes

- [x] 4.1 Implement control authentication configuration from `MODBUS_API_TOKEN` or an API Token file plus constant-time verification, and verify tests cover environment/file inputs, empty/unreadable files, correct/incorrect tokens and absence of secrets from outputs.
- [x] 4.2 Implement the shared `withControlApi` Route Handler wrapper for Host/Origin checks, authentication, strict parsing, standard envelopes, errors and `Cache-Control: no-store`, and verify route-wrapper tests cover public discovery, protected operations, closed CORS and every error class.
- [x] 4.3 Add `/api/v1`, `/api/v1/openapi.json`, `/api/v1/health`, `/api/v1/state` and `/api/v1/state/reset`, and verify route tests cover public schema discovery, stable instance metadata, ready/degraded health, full snapshots and deterministic resets.
- [x] 4.4 Add range and encoded register routes for all public table names using the control service and API log context, and verify route tests cover successful reads/writes, read-only-protocol fixture writes, strict failures, atomicity and `api` log source.
- [x] 4.5 Add v1 config, cursor logs, serial port and TCP client collection/item routes, and verify route tests cover successful operations, filters, apply failures, disconnect-all, disconnect-one and unknown client 404.

## 5. CLI Automation Protocol

- [x] 5.1 Make CLI option parsing strict and add `--host`, `--tcp-host`, `--api-token-file`, readiness options and `--version` while defaulting both listeners to `127.0.0.1`, and verify CLI tests assert valid forwarding plus exit code 2 before service creation for unknown or invalid values.
- [x] 5.2 Reject a non-loopback HTTP control listener without a Token while allowing authenticated LAN/container mode, and verify CLI integration tests cover loopback defaults, token environment/file inputs and unsafe-start rejection.
- [x] 5.3 Implement text/JSON readiness polling and the single-line `MODBUS_SIMULATOR_READY`/`MODBUS_SIMULATOR_ERROR` records without secrets, and verify tests prove READY follows actual health rather than process spawn.
- [x] 5.4 Implement timeout and child-process cleanup for `--strict-ready` while preserving degraded non-strict mode, and verify occupied-port integration tests assert strict nonzero exit/cleanup and human-mode diagnostic availability.

## 6. Dashboard Migration

- [x] 6.1 Add a centralized Dashboard v1 API client that unwraps envelopes, adds the session Bearer Token and surfaces stable errors, and verify client tests cover authenticated requests, 401, malformed responses and no Token in URLs.
- [x] 6.2 Migrate `useModbusData()` and all Dashboard mutations to `/api/v1/state`, v1 logs, config and resource endpoints while retaining one-second polling, and verify existing component tests plus a Dashboard smoke test observe and edit current singleton state.
- [x] 6.3 Add the 401 Token prompt, health validation and `sessionStorage`-only persistence, and verify a browser test proves a valid Token resumes polling while invalid Tokens are neither accepted nor written to `localStorage`.
- [x] 6.4 Display desired/actual lifecycle differences, degraded errors, system logs and API source in the Dashboard, add matching keys to en/zh/fr/ja locale files, and verify i18n key parity and UI tests for running, disabled and error states.

## 7. Agent Skill and Documentation

- [x] 7.1 Create `skills/modbus-simulator/SKILL.md` with valid frontmatter and the owned-process automation workflow, using `npx --yes @ruixe/modbus-simulator@latest`, JSON strict readiness and replaceable high ports, and verify Skills CLI lists the Skill and the exact default command appears in its instructions.
- [x] 7.2 Implement dependency-free Node.js 20 `skills/modbus-simulator/scripts/control.mjs` commands `wait`, `health`, `reset`, `read`, `write`, `write-encoded`, `config` and `logs`, and verify helper integration tests cover JSON output, optional Bearer auth and exit codes 0/2/3/4/5.
- [x] 7.3 Add Skill references for the v1 API, 0-based/human address mapping, typed values, Windows and Unix serial paths, LAN/container security and troubleshooting, and verify every link and command example resolves or passes a documentation smoke test.
- [x] 7.4 Update README.md and zh/fr/ja README variants plus add `docs/MIGRATION_1.1.md` with old-to-v1 endpoint, envelope, validation, bind/auth and breaking-change guidance, and verify repository search finds no documentation recommending removed endpoints or unauthenticated non-loopback mode.
- [x] 7.5 Verify a temporary `npx skills add . --skill modbus-simulator` installation contains the Skill and helper, then run `pnpm run publish:npm:dry-run` and verify the assembled npm package excludes root `skills/`.

## 8. Compatibility Removal and End-to-End Verification

- [x] 8.1 Remove every unversioned legacy API Route Handler and migrate remaining tests/code references without compatibility aliases, and verify requests to the documented old `/api/*` paths all return 404.
- [x] 8.2 Add an isolated Agent workflow test that starts on high ports, waits for READY, configures/resets state, performs HTTP-write/Modbus-read and Modbus-write/HTTP-read round trips, checks cursor logs and terminates only its owned process, and verify it passes repeatedly without port leakage.
- [x] 8.3 Add negative integration coverage for invalid atomic writes, range limits, protected non-loopback operation, Token redaction, config apply failure and readiness timeout, and verify all failures return the specified status/envelope or CLI exit code without unintended state changes.
- [x] 8.4 Update the npm publish workflow to gate publishing on format/lint, type-check, unit tests, E2E tests and npm dry-run assembly, and verify the workflow syntax plus a local equivalent command sequence succeeds.

## 9. Release 1.1.0

- [x] 9.1 Run `pnpm run format-lint`, `pnpm run type-check`, `pnpm run test:unit`, `pnpm run test:e2e` and `pnpm run publish:npm:dry-run` before changing the release version, and resolve every failure while preserving unrelated user changes.
- [x] 9.2 As the final implementation mutation, set package and lockfile version metadata to exactly `1.1.0`, and verify CLI `--version`, discovery, health, READY output, migration docs and npm dry-run all report `1.1.0` while the Skill still launches `@ruixe/modbus-simulator@latest`.
- [x] 9.3 Re-run the complete release gate after the version bump and inspect the packed file list, and verify all suites pass, old routes remain absent, the npm artifact excludes `skills/`, and no publishing command has been executed locally.
