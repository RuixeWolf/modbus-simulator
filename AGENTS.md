<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Modbus Simulator — Agent Guidelines

Modbus TCP / RTU serial device simulator: Next.js 16 (App Router) + React 19 + HeroUI v3 + Tailwind CSS v4. Features and REST API reference: [README.md](README.md).

## Commands

| Command                | Purpose                        |
| ---------------------- | ------------------------------ |
| `pnpm run dev`         | Dev server (default port 5000) |
| `pnpm run test:unit`   | Vitest unit tests              |
| `pnpm run test:e2e`    | Playwright E2E tests           |
| `pnpm run type-check`  | `tsc --noEmit`                 |
| `pnpm run format-lint` | Prettier + ESLint              |

- Focused unit test: `npx vitest run src/lib/modbus/engine.test.ts`
- Focused E2E test: `npx playwright test e2e/modbus.spec.ts --grep "<test name>"`. Playwright auto-starts the dev server via `webServer` in `playwright.config.ts` (reusing an already-running one locally) — never start a server manually first.
- Husky pre-commit runs lint-staged: Prettier + `eslint --fix` on staged JS/TS, plus a full `tsc --noEmit` whenever any `.ts/.tsx` file is staged.

### Dev server quirks

- `pnpm run dev` wraps `scripts/dev.mjs`, which forces **Webpack** (not Turbopack) via `NEXT_PRIVATE_LOCAL_WEBPACK=true` — Next.js 16's Turbopack has a broken internal font module on this platform.
- Loads `.env.local` (only `PORT`, `MODBUS_TCP_PORT`, `MODBUS_RTU_SERIAL_PATH` are read) and accepts CLI overrides: `-p/--port`, `-t/--tcp-port`, `-s/--serial-port`, `-i/--slave-id`, `-o/--open`.
- Server config (`src/lib/modbus/index.ts`) reads `MODBUS_*` env vars at **module scope** — changing them requires restarting the dev process, not just editing `.env.local`.

## Architecture

- **Singleton state**: `ModbusEngine.getInstance()` in `src/lib/modbus/engine.ts` owns all register state and survives HMR via `globalThis.__modbus_engine_instance__`.
- **Server lifecycle**: `ensureServersStarted()` from `src/lib/modbus/index.ts` is called at **module level** (not inside handlers) in every API route, and by the root `instrumentation.ts` hook on server boot. Keep new API routes consistent with this pattern.
- **No WebSocket / SSE**: the frontend polls REST endpoints every 1 second via `useModbusData()`.
- **Log source tagging**: writes from API routes are wrapped in `logSourceStore.run()` (AsyncLocalStorage, `src/lib/modbus/log-context.ts`) so the engine can tag log entries with a source (web/tcp/serial). Wrap any new write path the same way.

## Conventions

### UI — HeroUI v3 + Tailwind CSS v4

- **HeroUI v3** (not NextUI v2): compound components (`Switch.Control`, `Switch.Thumb`), no global Provider. Import from `@heroui/react`; styles come from `@import '@heroui/styles'` in `app/globals.css`.
- **Tailwind v4**: no `tailwind.config.js` — theme tokens via `@theme inline` in `app/globals.css`.
- **Dark mode is custom** (not HeroUI built-in): `@custom-variant dark` in `globals.css` + `.dark` class on `<html>` toggled by `useTheme()`.
- Coil toggles in `RegisterTable` are HeroUI `Button`s rendering ON/OFF text; boolean settings in `SettingsPanel` use HeroUI `Switch`.
- **i18n**: translations are imported as JSON at build time in `src/i18n/index.ts` — no HTTP backend. New keys must be added to all four locale files under `public/locales/` (en, zh, fr, ja).

### Modbus engine

- Register writes are **clamped to 16-bit**: `value & 0xffff`.
- Logs are stored chronologically; the UI renders them **reversed** (newest first).
- `resetInstance()` exists **only for unit tests**.
- `modbus-serial` and `serialport` are `serverExternalPackages` in `next.config.ts` — never import them in client components.
- `next.config.ts` enables `reactCompiler: true` (React Compiler via `babel-plugin-react-compiler`).

### Testing

- Vitest: `jsdom` environment, `globals: true`, `e2e/` excluded.
- E2E tests share the singleton engine state; `workers: 1` in CI; the Playwright `webServer` forces `MODBUS_TCP_PORT=11502` to avoid conflicts with a locally running instance.
- `MockModbusClient` uses `modbus-serial`'s `ModbusRTU` **default export** (`import ModbusRTU from 'modbus-serial'`), not a named import.

### Style

- Prettier (enforced by lint-staged): no semicolons, single quotes, print width 100, no trailing commas. It also auto-sorts imports (`react` → builtins → third-party → `@/` → relative) and Tailwind classes — let the hook reformat instead of hand-matching.

## Release

- Push to `main` auto-publishes to npm via OIDC Trusted Publishing whenever `package.json` `version` differs from the registry — bump the version to cut a release.
- `pnpm run publish:npm:dry-run` builds and assembles the publish bundle without publishing.

## Paths & temp files

- `@/` resolves to the project root (e.g., `@/src/lib/modbus`).
- Playwright MCP temp files (screenshots, snapshots, console logs) go in `.temp/` — gitignored, never the project root.
