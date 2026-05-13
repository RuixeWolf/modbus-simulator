# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Modbus Device Simulator built with Next.js 16 + HeroUI v3 + Tailwind CSS v4. It runs a Modbus TCP server and an RTU serial server backed by a singleton state engine, exposes REST APIs for frontend polling, and renders a real-time dashboard with paginated register tables, communication logs, and server settings.

## Common Commands

| Command                                                          | Purpose                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| `npm run dev`                                                    | Start Next.js dev server with Turbopack (default port 5000) |
| `.env.local`                                                     | Set `PORT` and other env vars (loaded automatically by Next.js) |
| `npm run build`                                                  | Production build                                     |
| `npm run lint`                                                   | Run ESLint                                           |
| `npm run format`                                                 | Run Prettier on all files                            |
| `npm run test:unit`                                              | Run Vitest unit tests                                |
| `npm run test:e2e`                                               | Run Playwright E2E tests (auto-starts dev server)    |
| `npm run test`                                                   | Run unit tests then E2E tests                        |
| `npx vitest run src/lib/modbus/engine.test.ts`                   | Run a single unit test file                          |
| `npx playwright test e2e/modbus.spec.ts --grep "UI to Protocol"` | Run a single E2E test by name                        |

## Architecture

### State Layer: Singleton ModbusEngine

`src/lib/modbus/engine.ts` is the single source of truth. It is an `EventEmitter` singleton managing:

- 1,000 coils (`boolean[]`)
- 1,000 discrete inputs (`boolean[]`)
- 10,000 holding registers (`number[]`, 16-bit values)
- 10,000 input registers (`number[]`, 16-bit values)
- Up to 1,000 in-memory communication logs

Use `ModbusEngine.getInstance()` everywhere. `resetInstance()` exists **only for unit tests** to avoid singleton leakage between tests.

### Server Layer: TCP + Serial RTU

**TCP Server** (`src/lib/modbus/tcp-server.ts`):

- Uses `modbus-serial`'s `ServerTCP` on a configurable port (default 502)
- Port can be changed at runtime via settings

**RTU Serial Server** (`src/lib/modbus/rtu-serial-server.ts`):

- Uses the `serialport` library to open a real serial port (e.g., `COM1`, `/dev/ttyUSB0`)
- Implements Modbus RTU frame parsing, CRC16 validation, and response generation for function codes 0x01-0x06
- Frame detection uses silence timeout (~15ms at 9600 baud)
- Serial path is configurable at runtime via settings; if no path is set, the RTU server does not start

**Server Manager** (`src/lib/modbus/index.ts`):

- `ensureServersStarted()` — called at module level in API routes; starts TCP server and RTU serial server (if configured)
- `getConfig()` / `setConfig()` — read/write `tcpPort`, `rtuSerialPath`, `rtuBaudRate`, `rtuParity`, `rtuDataBits`, `rtuStopBits`
- `restartServers()` — stops and restarts both servers with current config

**Critical**: API routes import `ensureServersStarted()` at the module level (not inside handlers). This causes Next.js to start the Modbus servers when the first API request is handled. The servers persist for the process lifetime.

`modbus-serial` and `serialport` are both marked as `serverExternalPackages` in `next.config.ts` because Turbopack cannot bundle their CJS-native code.

Custom type declarations live in `src/types/modbus-serial.d.ts` since the library has no bundled types.

### API Layer

All routes live under `app/api/` and call `ensureServersStarted()` on import:

- `GET /api/registers` — Full ModbusEngine state dump
- `POST /api/registers` — Write coil or holding register (body: `{ registerType, address, value }`)
- `GET /api/logs` — All communication logs
- `GET /api/status` — `{ tcp: boolean, rtu: boolean }`
- `GET /api/config` — `{ tcpPort, rtuSerialPath, rtuBaudRate, rtuParity, rtuDataBits, rtuStopBits }`
- `POST /api/config` — Update config and restart servers (body: any subset of config fields)
- `GET /api/serial-ports` — List available serial ports from `SerialPort.list()`

### Frontend Layer

The dashboard at `app/page.tsx` is a client component using `useModbusData()` which polls APIs every 1 second. There is no WebSocket or SSE — everything is REST polling.

**HeroUI v3 specifics** (not NextUI v2):

- Compound components: `Card.Header`, `Card.Content` — no `CardBody`/`CardHeader`
- No global Provider needed
- Native HTML `<table>` is used instead of HeroUI `Table` because HeroUI Table requires a react-aria collection context that breaks outside specific setups
- Native HTML `<select>` is used for dropdowns instead of HeroUI `Select` (which uses react-aria-components compound pattern)
- Coil toggles use HeroUI `Button` with ON/OFF text, not `Switch` (Switch required children for visibility in test snapshots)
- Do **not** use `Tabs.Indicator` — it causes a runtime `<SharedElement>` error in this setup

**Tailwind CSS v4**: Uses `@import "tailwindcss"` in `app/globals.css`. No `tailwind.config.js` — theme customization is done via `@theme inline` in CSS. Custom CSS variables (`--background`, `--foreground`, `--surface`, etc.) drive both light and dark modes.

**Layout**: `app/layout.tsx` uses `flex flex-col items-stretch` on `body` to ensure children span the full viewport width. `app/page.tsx` uses `min-h-screen w-full` for the root container. A theme script in `<head>` reads `localStorage` and applies the `.dark` class before React hydrates to prevent flash.

**i18n**: Translations are bundled at build time in `src/i18n/index.ts` (English and Chinese). No HTTP backend — JSON files from `public/locales/` are imported directly. `app/page.tsx` imports `@/src/i18n` to initialize before rendering.

**Theme**: Dark mode is custom (not HeroUI's built-in). `useTheme()` in `src/hooks/useTheme.ts` manages a `localStorage` preference (`light` / `dark` / `system`) and toggles the `.dark` class on `<html>`.

### Testing

**Unit tests** (`vitest.config.ts`):

- Environment: `jsdom`, `globals: true`
- Run with `npm run test:unit`
- `src/lib/modbus/engine.test.ts` tests singleton behavior, register R/W, events, and clamping

**E2E tests** (`playwright.config.ts`):

- `webServer` auto-starts `npm run dev` before tests
- Environment variable `MODBUS_TCP_PORT=11502` is set for E2E tests to avoid port conflicts
- Tests run serially (`mode: 'serial'`) because they share the singleton ModbusEngine state
- `MockModbusClient` in `src/lib/modbus/mock-client.ts` connects via `modbus-serial`'s `ModbusRTU` **default export** (not named import)
- Tests verify UI→Protocol, Protocol→UI, coil toggles, and error logging

## Important Conventions

- Register values are clamped to 16-bit (`value & 0xffff`) on write
- Log entries are stored chronologically; UI renders them reversed (newest first)
- The `modbus-serial` `ServerTCP` vector callbacks use Node-style `(err, value)` signatures
- Out-of-range Modbus requests return proper Modbus exception codes via the library; errors are also logged in-engine via `addErrorLog()`
- The old `src/lib/modbus/rtu-server.ts` (TCP bridge on port 5021) is no longer used; RTU is now handled by `rtu-serial-server.ts`
- `next.config.ts` enables `reactCompiler: true`
- Path alias `@/` resolves to the project root (e.g., `@/src/lib/modbus`)
