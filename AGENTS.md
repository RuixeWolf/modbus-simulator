<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes. Its APIs, conventions, and file structure may differ from your training data. Before writing code, read the relevant guide in `node_modules/next/dist/docs/`. Resolve that path from this file's directory because a monorepo may not expose the `next` package at its root. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Modbus Simulator — Agent Guidelines

Modbus Transmission Control Protocol (TCP) / Remote Terminal Unit (RTU) serial device simulator: Next.js 16 (App Router) + React 19 + HeroUI v3 + Tailwind CSS v4. Features and REST API reference: [README.md](README.md).

## Commands

| Command                | Purpose                        |
| ---------------------- | ------------------------------ |
| `pnpm run dev`         | Dev server (default port 5000) |
| `pnpm run test:unit`   | Vitest unit tests              |
| `pnpm run test:e2e`    | Playwright E2E tests           |
| `pnpm run type-check`  | `tsc --noEmit`                 |
| `pnpm run format-lint` | Prettier + ESLint              |

- Run one unit test file with `npx vitest run src/lib/modbus/engine.test.ts`.
- Run one end-to-end (E2E) test with `npx playwright test e2e/modbus.spec.ts --grep "<test name>"`.
- Playwright starts the dev server through `webServer` in `playwright.config.ts` and reuses a local server when available. Avoid starting another server unless the test configuration requires it.
- Husky pre-commit runs lint-staged.
- For staged JavaScript or TypeScript, lint-staged runs Prettier and `eslint --fix`.
- For staged `.ts` or `.tsx` files, it also runs `tsc --noEmit`.

### Dev server quirks

- `pnpm run dev` wraps `scripts/dev.mjs`, which forces **Webpack** (not Turbopack) via `NEXT_PRIVATE_LOCAL_WEBPACK=true` — Next.js 16's Turbopack has a broken internal font module on this platform.
- Loads `.env.local`. The supported environment variables are the application port (`PORT`), Modbus TCP port (`MODBUS_TCP_PORT`), and Modbus RTU serial path (`MODBUS_RTU_SERIAL_PATH`). Command-line interface overrides are `-p/--port`, `-t/--tcp-port`, `-s/--serial-port`, `-i/--slave-id`, and `-o/--open`.
- Server config (`src/lib/modbus/index.ts`) reads `MODBUS_*` env vars at **module scope** — changing them requires restarting the dev process, not just editing `.env.local`.

## Architecture

- **Singleton state**: `ModbusEngine.getInstance()` in `src/lib/modbus/engine.ts` owns all register state and survives hot module replacement (HMR) via `globalThis.__modbus_engine_instance__`.
- **Server lifecycle**: `ensureServersStarted()` from `src/lib/modbus/index.ts` is called at **module level** (not inside handlers) in every API route, and by the root `instrumentation.ts` hook on server boot. Keep new API routes consistent with this pattern.
- **No WebSocket / server-sent events (SSE)**: the frontend polls REST endpoints every 1 second via `useModbusData()`.
- **Log source tagging**: writes from API routes are wrapped in `logSourceStore.run()`. The wrapper uses `AsyncLocalStorage` from `src/lib/modbus/log-context.ts`. This lets the engine tag entries with a web, TCP, or serial source. Apply the same wrapper to new write paths.

## Conventions

### UI — HeroUI v3 + Tailwind CSS v4

- **HeroUI v3** (not NextUI v2): compound components (`Switch.Control`, `Switch.Thumb`), no global Provider. Import from `@heroui/react`; styles come from `@import '@heroui/styles'` in `app/globals.css`.
- **Tailwind v4**: no `tailwind.config.js` — theme tokens via `@theme inline` in `app/globals.css`.
- **Dark mode is custom** (not HeroUI built-in): `@custom-variant dark` in `globals.css` + `.dark` class on `<html>` toggled by `useTheme()`.
- Coil toggles in `RegisterTable` are HeroUI `Button`s rendering enabled/disabled text; boolean settings in `SettingsPanel` use HeroUI `Switch`.
- **Internationalization (i18n)**: translations are imported as JSON at build time in `src/i18n/index.ts`; there is no HTTP backend. Add new keys to all four locale files under `public/locales/` unless a documented locale fallback is intentional.

### Modbus engine

- Register writes are **clamped to 16-bit**: `value & 0xffff`.
- Logs are stored chronologically; the UI renders them **reversed** (newest first).
- `resetInstance()` exists **only for unit tests**.
- `modbus-serial` and `serialport` are `serverExternalPackages` in `next.config.ts`. Keep them out of client components unless the bundling strategy is deliberately changed and verified.
- `next.config.ts` enables `reactCompiler: true` (React Compiler via `babel-plugin-react-compiler`).

### Testing

- Vitest: `jsdom` environment, `globals: true`, `e2e/` excluded.
- E2E tests share the singleton engine state; `workers: 1` in CI; the Playwright `webServer` forces `MODBUS_TCP_PORT=11502` to avoid conflicts with a locally running instance.
- `MockModbusClient` uses `modbus-serial`'s `ModbusRTU` **default export** (`import ModbusRTU from 'modbus-serial'`), not a named import.

### Style

- Prettier (enforced by lint-staged): no semicolons, single quotes, print width 100, no trailing commas. It also auto-sorts imports (`react` → builtins → third-party → `@/` → relative) and Tailwind classes — let the hook reformat instead of hand-matching.

## Release

- Push to `main` auto-publishes to npm through OpenID Connect (OIDC) Trusted Publishing whenever the `package.json` version differs from the registry. Bump the version to cut a release.
- `pnpm run publish:npm:dry-run` builds and assembles the publish bundle without publishing.

## Paths & temp files

- `@/` resolves to the project root (e.g., `@/src/lib/modbus`).
- Store temporary Playwright Model Context Protocol (MCP) files in the gitignored `.temp/` directory. If a tool requires another location, keep its screenshots, snapshots, and console logs outside the project root.
