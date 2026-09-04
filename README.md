<div align="center">

# Modbus Device Simulator

<p>
  <a href="docs/README_CN.md">中文</a> |
  <a href="docs/README_FR.md">Français</a> |
  <a href="docs/README_JA.md">日本語</a>
</p>

A free Modbus TCP / RTU Serial device simulator with a real-time web dashboard.

> **Vibe Coding** — This project is built primarily through AI-assisted rapid development.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

**Modbus Device Simulator** is a full-stack Modbus device simulator built with modern web technologies. It runs both a **Modbus TCP server** and an **RTU serial server**, backed by a high-performance singleton state engine, and exposes a real-time web dashboard for monitoring and controlling registers, viewing communication logs, and configuring server settings.

Whether you are developing Modbus client applications, testing PLC integrations, or learning the Modbus protocol, this simulator provides a lightweight, zero-hardware solution.

## Features

- **Dual Protocol Support**
  - **Modbus TCP Server** — Configurable port (default 502) with active client tracking
  - **Modbus RTU Serial Server** — Real serial port integration with configurable baud rate, parity, data bits, and stop bits
- **Full Register Coverage**
  - 1,000 Coils (read/write boolean)
  - 1,000 Discrete Inputs (read-only boolean)
  - 10,000 Holding Registers (read/write 16-bit)
  - 10,000 Input Registers (read-only 16-bit)
- **Real-Time Dashboard**
  - Live register tables with pagination and goto-address
  - Toggle coils and write holding/input register values directly from the UI
  - **Advanced Register Writing** — Write multi-register values using typed data formats (UInt8, Int16BE, FloatBE, DoubleLE, etc.) or raw hex byte strings
  - Communication logs in reverse chronological order (newest first)
  - Configurable log filtering (read / write / error / connection)
  - Server status, active TCP clients, and configuration panel
- **Communication Logging**
  - In-memory log buffer with configurable max count (100–10,000 entries)
  - Track requests, responses, errors, and TCP connections
  - Per-entry log source annotation (TCP, serial, or web)
- **Internationalization**
  - English, Chinese (中文), French (Français), and Japanese (日本語)
- **Theme Support**
  - Light / Dark / System theme modes
- **REST API**
  - Full HTTP API for external integration and automation, including batch register writes

### Web Dashboard

![Web Dashboard](docs/screenshots/web-dashboard.png)

## Tech Stack

| Layer      | Technology                                                            |
| ---------- | --------------------------------------------------------------------- |
| Framework  | [Next.js](https://nextjs.org/) 16 (App Router)                        |
| UI Library | [React](https://react.dev/) 19                                        |
| Components | [HeroUI](https://www.heroui.com/) v3                                  |
| Styling    | [Tailwind CSS](https://tailwindcss.com/) v4                           |
| Language   | [TypeScript](https://www.typescriptlang.org/)                         |
| Modbus TCP | [modbus-serial](https://github.com/yaacov/node-modbus-serial)         |
| Modbus RTU | [serialport](https://serialport.io/) + custom frame parser            |
| Testing    | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) |
| Icons      | [Iconify](https://iconify.design/) (Lucide)                           |
| Animation  | [Framer Motion](https://www.framer.com/motion/)                       |

## Quick Start

### Run with NPX (No Installation)

The fastest way to get started — no cloning or installation required:

```bash
npx @ruixe/modbus-simulator@latest
```

With options:

```bash
npx @ruixe/modbus-simulator@latest -p 8080 -t 5020 -o
```

See all available options:

```bash
npx @ruixe/modbus-simulator@latest --help
```

### Prerequisites

- [Node.js](https://nodejs.org/) 20.6 or later
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

### Installation (Development)

```bash
# Clone the repository
git clone https://github.com/RuixeWolf/modbus-simulator.git
cd modbus-simulator

# Install dependencies
npm install
# or
pnpm install
```

### Development

```bash
# Start the development server (default port 5000)
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

The Modbus TCP server starts automatically on port `502` (or as configured). The RTU serial server starts only when a serial port path is configured.

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Configuration

Create a `.env.local` file in the project root to customize settings:

```bash
# Next.js dev server port (default is 5000)
PORT=5000

# Modbus TCP port (used in production; dev server always starts TCP on 502)
MODBUS_TCP_PORT=502
```

Server settings can also be changed at runtime through the web dashboard or the authenticated `/api/v1/config` endpoint. HTTP and Modbus TCP listeners bind to `127.0.0.1` by default. Set `MODBUS_API_TOKEN` (or use `--api-token-file`) before exposing the HTTP listener on a non-loopback interface.

## Usage

### Web Dashboard

1. Open the dashboard at `http://localhost:5000`
2. **Registers** — View all coils, discrete inputs, holding registers, and input registers. Toggle coils or edit register values directly. Use **Advanced Write** for multi-register typed values or raw hex bytes.
3. **Logs** — Monitor all Modbus communication in real time. Filter by log type and clear logs as needed.
4. **Settings** — Configure the TCP port, slave ID, RTU serial port path, serial parameters, log filter, and log max count. Changes take effect immediately after restarting the servers.

### Connect with a Modbus Client

**Modbus TCP (using [modbus-serial](https://github.com/yaacov/node-modbus-serial)):**

```javascript
const { ModbusTCP } = require('modbus-serial')
const client = new ModbusTCP()
await client.connectTCP('127.0.0.1', { port: 502 })

// Read holding registers
const data = await client.readHoldingRegisters(0, 10)
console.log(data.data)

// Write a coil
await client.writeCoil(0, true)

client.close()
```

**Modbus RTU (serial port):**

Configure the RTU serial path (e.g., `COM3` on Windows, `/dev/ttyUSB0` on Linux) in the dashboard settings, then connect with any standard Modbus RTU client.

## Automation and API v1

Version 1.1.0 provides a strict, versioned control API for scripts and AI agents. Start an isolated loopback instance and wait for real health readiness:

```bash
npx --yes @ruixe/modbus-simulator@latest --host 127.0.0.1 --port 15000 --tcp-host 127.0.0.1 --tcp-port 15020 --ready-output json --ready-timeout 30 --strict-ready
```

Public discovery is available at `GET /api/v1` and `GET /api/v1/openapi.json`. Operational routes include health, full state and reset, bounded register ranges, typed/hex encoded writes, configuration, cursor logs, serial ports, and TCP clients. Successful JSON responses use `{ "data": ..., "meta": ... }`; failures use `{ "error": { "code", "message", "issues"? }, "meta": ... }`.

When a Token is configured, send `Authorization: Bearer <token>` to protected routes. Browser Tokens are validated by `/api/v1/health` and kept only in `sessionStorage`. All bodies and query strings are strictly validated, register addresses are 0-based, range writes are atomic, and ranges are limited to 1,000 values.

```bash
curl http://127.0.0.1:5000/api/v1/registers/holding-registers?start=0\&count=2

curl -X PUT http://127.0.0.1:5000/api/v1/registers/holding-registers/encoded \
  -H "Content-Type: application/json" \
  -d '{"address":0,"dataType":"FloatBE","value":3.14}'
```

### Agent Skill

Install the Modbus Simulator Agent Skill with [`npx skills`](https://skills.sh/) to give a supported coding agent a reusable, safe workflow for running a disposable simulator in integration tests:

```bash
npx skills add RuixeWolf/modbus-simulator --skill modbus-simulator --agent codex
```

Omit `--agent codex` to select a detected agent interactively, or replace `codex` with another supported agent. After installation, ask your agent to use the `modbus-simulator` skill when a test needs an isolated Modbus TCP/RTU device. The skill starts a process it owns on replaceable high ports, waits for health readiness, uses the control API for fixtures and assertions, collects diagnostics, and cleans up only that process.

For the complete workflow and helper commands, see the repository [Agent Skill](skills/modbus-simulator/SKILL.md). See also [the generated OpenAPI document](http://127.0.0.1:5000/api/v1/openapi.json) and the [1.1 migration guide](docs/MIGRATION_1.1.md).

## Project Structure

```
modbus-simulator/
├── app/
│   ├── api/v1/                 # Versioned control API + OpenAPI routes
│   ├── globals.css             # Tailwind CSS v4 entry + theme variables
│   ├── layout.tsx              # Root layout with i18n & theme
│   └── page.tsx                # Dashboard page (client component)
├── src/
│   ├── components/
│   │   ├── AdvancedWriteModal.tsx   # Advanced multi-register write modal
│   │   ├── LanguageSwitcher.tsx     # Language switcher
│   │   ├── LogPanel.tsx             # Communication log panel
│   │   ├── RegisterTable.tsx        # Paginated register table
│   │   ├── SettingsPanel.tsx        # Server settings panel
│   │   ├── StatusIndicator.tsx      # Server status indicator
│   │   ├── TcpClientPanel.tsx       # Active TCP client list
│   │   └── ThemeToggle.tsx          # Light/dark/system theme toggle
│   ├── hooks/
│   │   ├── useModbusData.ts    # React hook for polling Modbus data
│   │   └── useTheme.ts         # Theme (light/dark/system) management
│   ├── i18n/
│   │   └── index.ts            # i18next initialization (EN / CN / FR / JA)
│   ├── lib/
│   │   └── modbus/
│   │       ├── buffer-convert.ts     # Typed data type ↔ buffer conversions
│   │       ├── engine.ts             # Singleton ModbusEngine (state + events)
│   │       ├── engine.test.ts        # Unit tests for engine
│   │       ├── index.ts              # Server manager (start/stop/config)
│   │       ├── log-context.ts        # AsyncLocalStorage for log source context
│   │       ├── mock-client.ts        # Mock client for E2E tests
│   │       ├── rtu-serial-server.ts  # Modbus RTU serial server
│   │       └── tcp-server.ts         # Modbus TCP server
│   └── types/
│       └── modbus-serial.d.ts  # Custom type declarations
├── docs/                       # Documentation and screenshots
├── e2e/                        # Playwright E2E tests
├── public/locales/             # Translation JSON files (en, zh, fr, ja)
├── next.config.ts
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

## Testing

```bash
# Run unit tests (Vitest)
npm run test:unit

# Run E2E tests (Playwright)
npm run test:e2e

# Run all tests
npm run test

# Run a specific unit test file
npx vitest run src/lib/modbus/engine.test.ts

# Run a specific E2E test
npx playwright test e2e/modbus.spec.ts --grep "UI to Protocol"
```

## Available Scripts

| Script               | Description                                  |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | Start development server (default port 5000) |
| `npm run build`      | Production build                             |
| `npm run start`      | Start production server                      |
| `npm run lint`       | Run ESLint                                   |
| `npm run format`     | Format all files with Prettier               |
| `npm run type-check` | Run TypeScript compiler (no emit)            |
| `npm run test:unit`  | Run Vitest unit tests                        |
| `npm run test:e2e`   | Run Playwright E2E tests                     |
| `npm run test`       | Run unit tests then E2E tests                |

## License

[MIT](LICENSE)
