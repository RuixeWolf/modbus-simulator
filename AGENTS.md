<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Modbus Simulator — Agent Guidelines

A Modbus TCP (Transmission Control Protocol) / RTU (Remote Terminal Unit) serial device simulator built with Next.js 16 + HeroUI v3 + Tailwind CSS v4.

For full project details see [CLAUDE.md](CLAUDE.md) and [README.md](README.md).

## Build & Test

| Command                | Purpose                              |
| ---------------------- | ------------------------------------ |
| `pnpm run dev`         | Start dev server (default port 5000) |
| `pnpm run test:unit`   | Vitest unit tests                    |
| `pnpm run test:e2e`    | Playwright E2E tests                 |
| `pnpm run test`        | Unit + E2E                           |
| `pnpm run type-check`  | `tsc --noEmit`                       |
| `pnpm run format-lint` | Prettier + ESLint                    |

Pre-commit hooks run `lint-staged` automatically.

### Dev server quirks

- `pnpm run dev` forces **Webpack** (not Turbopack) via `NEXT_PRIVATE_LOCAL_WEBPACK=true` because Next.js 16's Turbopack has a broken internal font module on this platform.
- The dev script reads `.env.local` and accepts CLI overrides: `--port`, `--tcp-port`, `--serial-port`, `--slave-id`, `--open`.

## Architecture

- **Singleton state**: `src/lib/modbus/engine.ts` is the single source of truth. Use `ModbusEngine.getInstance()`. It survives Next.js Hot Module Replacement (HMR) via `globalThis.__modbus_engine_instance__`.
- **Server lifecycle**: `src/lib/modbus/index.ts` manages TCP and RTU serial servers. API routes import `ensureServersStarted()` at the **module level** (not inside handlers). `instrumentation.ts` also calls it eagerly on server boot.
- **No WebSocket / Server-Sent Events (SSE)**: The frontend polls REST APIs every 1 second via `useModbusData()`.

## Critical Conventions

### UI — HeroUI v3 + Tailwind CSS v4

- **HeroUI v3** (not NextUI v2): Compound components (`Card.Header`, `Card.Content`), no global Provider, CSS animations.
- **Tailwind v4**: `@import "tailwindcss"` in `globals.css`. No `tailwind.config.js` — theme customization via `@theme inline` in CSS.
- Use **native HTML `<table>`** instead of HeroUI `Table` (react-aria collection context issues).
- Use **native HTML `<select>`** instead of HeroUI `Select`.
- Coil toggles use HeroUI `Button` with on/off text, not `Switch`.

### Modbus Engine

- Register writes are **clamped to 16-bit**: `value & 0xffff`.
- Log entries are stored chronologically; UI renders them **reversed** (newest first).
- `resetInstance()` exists **only for unit tests**.
- `modbus-serial` and `serialport` are `serverExternalPackages` in `next.config.ts` — do not import in client components.

### Testing

- E2E tests share singleton state; `workers: 1` in CI.
- `MockModbusClient` uses `modbus-serial`'s `ModbusRTU` **default export** (not named import).
- E2E tests set `MODBUS_TCP_PORT=11502` to avoid conflicts.

### i18n & Theme

- i18n bundled at build time (`src/i18n/index.ts`), no HTTP backend.
- Dark mode is custom (not HeroUI built-in): `useTheme()` toggles `.dark` class on `<html>`.

## Path Alias

- `@/` resolves to project root (e.g., `@/src/lib/modbus`).

## Temporary Files

When using Playwright Model Context Protocol (MCP) tools (screenshots, snapshots, console logs), **always write temp files to `.temp/`** — never the project root. The `.temp/` directory is gitignored except for `.gitkeep`.
