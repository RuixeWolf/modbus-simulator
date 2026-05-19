# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Modbus Device Simulator built with Next.js 16 + HeroUI v3 + Tailwind CSS v4. It runs a Modbus TCP server and an RTU serial server backed by a singleton state engine, exposes REST APIs for frontend polling, and renders a real-time dashboard with paginated register tables, communication logs, and server settings.

## Common Commands

| Command                                                          | Purpose                                                     |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `pnpm run dev`                                                   | Start Next.js dev server with Turbopack (default port 5000) |
| `pnpm run build`                                                 | Production build                                            |
| `pnpm run build:standalone`                                      | Build standalone distributable into `dist/`                 |
| `pnpm run start`                                                 | Start production server (uses `.next/standalone`)           |
| `pnpm run lint`                                                  | Run ESLint                                                  |
| `pnpm run format`                                                | Run Prettier on all files                                   |
| `pnpm run format-lint`                                           | Run Prettier then ESLint                                    |
| `pnpm run type-check`                                            | Run TypeScript compiler (no emit)                           |
| `pnpm run test:unit`                                             | Run Vitest unit tests                                       |
| `pnpm run test:e2e`                                              | Run Playwright E2E tests (auto-starts dev server)           |
| `pnpm run test`                                                  | Run unit tests then E2E tests                               |
| `pnpm run publish:npm`                                           | Build and publish to NPM                                    |
| `pnpm run publish:npm:dry-run`                                   | Build and verify publish package without uploading          |
| `npx vitest run src/lib/modbus/engine.test.ts`                   | Run a single unit test file                                 |
| `npx playwright test e2e/modbus.spec.ts --grep "UI to Protocol"` | Run a single E2E test by name                               |

The dev script (`scripts/dev.mjs`) behavior:

- Defaults to port `5000` when the network listening port (`PORT` environment variable) is unset.
- Loads an optional `.env.local` file when present.
- Allows CLI overrides via `--port`, `--tcp-port`, `--serial-port`, `--slave-id`, and `--open`.

### Pre-commit Checks

**lint-staged** (configured in `lint-staged.config.mjs`) runs automatically on every `git commit` via the `.husky/pre-commit` hook:

| File pattern                    | Commands run                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `*.{js,jsx,ts,tsx,mjs,cjs}`     | `prettier --write` → `eslint --fix`                                               |
| `*.{ts,tsx}`                    | `tsc --noEmit` (via function signature so lint-staged does not append file paths) |
| `*.{json,md,css,yml,yaml,html}` | `prettier --write`                                                                |

`tsc` uses a function signature `() => 'tsc --noEmit'` because lint-staged appends staged file paths to string commands by default, which causes TypeScript to ignore `tsconfig.json`.

### Native Module Builds

`pnpm-workspace.yaml` enables builds for `@serialport/bindings-cpp`. On fresh installs, PNPM may prompt to build this native dependency — approve it, or the RTU serial server will fail at runtime.

## Architecture

### State Layer: Singleton ModbusEngine

`src/lib/modbus/engine.ts` is the single source of truth. It is an `EventEmitter` singleton managing:

- 1,000 coils (`boolean[]`)
- 1,000 discrete inputs (`boolean[]`)
- 10,000 holding registers (`number[]`, 16-bit values)
- 10,000 input registers (`number[]`, 16-bit values)
- Up to 1,000 in-memory communication logs

Use `ModbusEngine.getInstance()` everywhere.

- `resetInstance()` exists **only for unit tests** to avoid singleton leakage between tests.
- The engine instance is stored on `globalThis.__modbus_engine_instance__`.
- The global storage approach keeps the instance alive across Next.js Hot Module Replacement (HMR) / module reloads in dev mode.
- The singleton persistence strategy mirrors the behavior used by the server layer.

### Server Layer: TCP + Serial RTU

**TCP Server** (`src/lib/modbus/tcp-server.ts`):

- Uses `modbus-serial`'s `ServerTCP` on a configurable port (default 502)
- Configurable Modbus slave ID / unit ID (default 1, range 1–247)
- Port and slave ID can be changed at runtime via settings

**RTU Serial Server** (`src/lib/modbus/rtu-serial-server.ts`):

- Uses the `serialport` library to open a real serial port (e.g., `COM1`, `/dev/ttyUSB0`)
- Implements Modbus RTU frame parsing, CRC16 validation, and response generation for function codes 0x01-0x06
- Frame detection uses silence timeout (~15ms at 9600 baud)
- Respects the configurable Modbus slave ID (default 1); frames addressed to a different slave ID are ignored
- Serial path is configurable at runtime via settings; if no path is set, the RTU server does not start

**Server Manager** (`src/lib/modbus/index.ts`):

- `ensureServersStarted()` — called at module level in API routes; starts TCP server and RTU serial server (if configured)
- `getConfig()` / `setConfig()` — read/write `tcpPort`, `slaveId`, `rtuSerialPath`, `rtuBaudRate`, `rtuParity`, `rtuDataBits`, `rtuStopBits`
- `restartServers()` — stops and restarts both servers with current config
- Uses `globalThis.__modbus_initialized__` to survive Next.js HMR / module reloads in dev mode

**Critical**: API routes import `ensureServersStarted()` at the module level (not inside handlers). This causes Next.js to start the Modbus servers when the first API request is handled. The servers persist for the process lifetime.

Additionally, `instrumentation.ts` implements Next.js's `register()` hook, which also calls `ensureServersStarted()`. This eagerly starts the servers when the Next.js process boots, complementing the lazy startup via API route imports.

`modbus-serial` and `serialport` are both marked as `serverExternalPackages` in `next.config.ts` because Turbopack cannot bundle their CJS-native code.

Custom type declarations live in `src/types/modbus-serial.d.ts` since the library has no bundled types.

**Instrumentation Hook** (`instrumentation.ts`):

Next.js 16 calls `register()` in `instrumentation.ts` once when the server process starts. This eagerly starts the Modbus servers via `ensureServersStarted()` instead of waiting for the first HTTP API request. This is an additional startup path alongside the module-level API route imports.

### API Layer

All routes live under `app/api/` and call `ensureServersStarted()` on import:

- `GET /api/registers` — Full ModbusEngine state dump
- `POST /api/registers` — Write coil or holding register (body: `{ registerType, address, value }`)
- `GET /api/logs` — All communication logs
- `GET /api/status` — `{ tcp: boolean, rtu: boolean }`
- `GET /api/config` — `{ tcpPort, slaveId, rtuSerialPath, rtuBaudRate, rtuParity, rtuDataBits, rtuStopBits, logFilter }`
- `POST /api/config` — Update config and restart servers. The request body may include a supported subset of config fields. Invalid values are rejected (for example, `slaveId` outside 1-247). `logFilter` controls which log types are recorded.
- `GET /api/serial-ports` — List available serial ports from `SerialPort.list()`

All API routes export `dynamic = 'force-dynamic'` to prevent Next.js from attempting static optimization.

### Frontend Layer

The dashboard at `app/page.tsx` is a client component using `useModbusData()` which polls APIs every 1 second. There is no WebSocket or SSE — everything is REST polling.

**HeroUI v3 specifics** (not NextUI v2):

- Compound components: `Card.Header`, `Card.Content` — no `CardBody`/`CardHeader`; `Tabs.ListContainer`, `Tabs.List`, `Tabs.Tab`, `Tabs.Indicator`, `Tabs.Panel` for tabs
- No global Provider needed
- Native HTML `<table>` is used instead of HeroUI `Table` because HeroUI Table requires a react-aria collection context that breaks outside specific setups
- Native HTML `<select>` is used for dropdowns instead of HeroUI `Select` (which uses react-aria-components compound pattern)
- Coil toggles use HeroUI `Button` with ON/OFF text, not `Switch` (Switch required children for visibility in test snapshots)

**Tailwind CSS v4**:

- Use `@import "tailwindcss"` in `app/globals.css`.
- This project does not use `tailwind.config.js`.
- Theme customization is done with `@theme inline` in CSS.
- CSS variables `--background`, `--foreground`, `--accent`, `--accent-foreground`, `--surface`, `--surface-secondary`, `--muted`, `--default`, and `--border` drive both light and dark modes.
- **Critical**: `@import "@heroui/styles"` is also required in `globals.css` so HeroUI v3 components render correctly.

**Layout**:

- `app/layout.tsx` uses `flex flex-col items-stretch` on `body` so children span the full viewport width.
- `app/page.tsx` uses `min-h-screen w-full` for the root container.
- The `<html>` tag has `suppressHydrationWarning` because of the theme bootstrap script.
- The `<head>` script reads `localStorage.getItem('theme-preference')` and sets both `data-theme` (HeroUI styles) and `.dark` (Tailwind `@custom-variant dark`) before React hydration, which avoids theme flash.

**i18n**: Translations are bundled at build time in `src/i18n/index.ts` (English and Chinese). No HTTP backend — JSON files from `public/locales/` are imported directly. `app/page.tsx` imports `@/src/i18n` to initialize before rendering.

**Theme**: Dark mode is custom (not HeroUI's built-in). `useTheme()` in `src/hooks/useTheme.ts` manages a `localStorage` preference (`light` / `dark` / `system`) and toggles the `.dark` class on `<html>`.

### Testing

**Unit tests** (`vitest.config.ts`):

- Environment: `jsdom`, `globals: true`
- Run with `pnpm run test:unit`
- `src/lib/modbus/engine.test.ts` tests singleton behavior, register R/W, events, and clamping

**E2E tests** (`playwright.config.ts`):

- `webServer` auto-starts `pnpm run dev` before tests
- Environment variables `MODBUS_TCP_PORT=11502` and `MODBUS_RTU_SERIAL_PATH='COM3'` are set for the E2E test webServer to avoid port conflicts and provide a mock RTU path
- Tests run serially (`workers: 1` in CI, `fullyParallel: true` locally) because they share the singleton ModbusEngine state
- `MockModbusClient` in `src/lib/modbus/mock-client.ts` connects via `modbus-serial`'s `ModbusRTU` **default export** (not named import)
- Tests verify UI→Protocol, Protocol→UI, coil toggles, and error logging

## Important Conventions

- Register values are clamped to 16-bit (`value & 0xffff`) on write
- Log entries are stored chronologically; UI renders them reversed (newest first)
- The engine respects a `LogFilterConfig` (read/write/error booleans). Disabled types are silently dropped before storage and can be toggled at runtime via `POST /api/config`
- The `modbus-serial` `ServerTCP` vector callbacks use Node-style `(err, value)` signatures
- Out-of-range Modbus requests return proper Modbus exception codes via the library; errors are also logged in-engine via `addErrorLog()`
- The old `src/lib/modbus/rtu-server.ts` (TCP bridge on port 5021) is no longer used; RTU is now handled by `rtu-serial-server.ts`
- `next.config.ts` enables `reactCompiler: true` and `output: 'standalone'`
- Path alias `@/` resolves to the project root (e.g., `@/src/lib/modbus`)
- ESLint uses flat config (`eslint.config.mjs`) with typescript-eslint, @eslint-react, eslint-plugin-react-hooks, and @next/eslint-plugin-next
- `pnpm run build:standalone` creates a distributable in `dist/{name}_{version}/` with `cli.mjs` as the entry point; it fixes PNPM (Performant npm) symlinks and strips devDependencies so the output runs without `npm install`
- For Next.js 16-specific agent rules and breaking changes, see `AGENTS.md`
