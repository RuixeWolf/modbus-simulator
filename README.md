<div align="center">

# Modbus Device Simulator

<p>
  <a href="README_CN.md">中文</a>
</p>

A professional Modbus TCP / RTU Serial device simulator with a real-time web dashboard.

> **Vibe Coding** — This project is built primarily through AI-assisted rapid development.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

**Modbus Device Simulator** is a full-stack Modbus device simulator built with modern web technologies. It runs both a **Modbus TCP server** and an **RTU serial server** backed by a high-performance singleton state engine, and exposes a real-time web dashboard for monitoring and controlling registers, viewing communication logs, and configuring server settings.

Whether you are developing Modbus client applications, testing PLC integrations, or learning the Modbus protocol, this simulator provides a lightweight, zero-hardware solution.

## Features

- **Dual Protocol Support**
  - **Modbus TCP Server** — Configurable port (default 502)
  - **Modbus RTU Serial Server** — Real serial port integration with configurable baud rate, parity, data bits, and stop bits
- **Full Register Coverage**
  - 1,000 Coils (read/write boolean)
  - 1,000 Discrete Inputs (read-only boolean)
  - 10,000 Holding Registers (read/write 16-bit)
  - 10,000 Input Registers (read-only 16-bit)
- **Real-Time Dashboard**
  - Live register tables with pagination
  - Toggle coils and write holding register values directly from the UI
  - Communication logs in reverse chronological order (newest first)
  - Server status and configuration panel
- **Communication Logging**
  - In-memory log buffer (up to 1,000 entries)
  - Track requests, responses, and errors
- **Internationalization**
  - English and Chinese (中文) language support
- **Theme Support**
  - Light / Dark / System theme modes
- **REST API**
  - Full HTTP API for external integration and automation

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

## Screenshots

### Dashboard Overview

Real-time Modbus TCP/RTU register monitoring with server status, settings, and paginated register tables.

![Dashboard Overview](docs/screenshots/dashboard.png)

### Holding Registers

View and edit 16-bit holding register values directly from the UI.

![Holding Registers](docs/screenshots/holding-registers.png)

### Communication Logs

Monitor all Modbus requests, responses, and errors in real time.

![Communication Logs](docs/screenshots/communication-logs.png)

### Dark Mode

Full dark theme support for comfortable low-light usage.

![Dark Mode](docs/screenshots/dark-mode.png)

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/modbus-simulator.git
cd modbus-simulator

# Install dependencies
npm install
# or
pnpm install
```

### Development

```bash
# Start the development server (default port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

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
# Next.js dev server port (default is 3000)
PORT=3000

# Modbus TCP port (used in production; dev server always starts TCP on 502)
MODBUS_TCP_PORT=502
```

Server settings (TCP port, RTU serial path, baud rate, parity, etc.) can also be changed at runtime via the web dashboard or the `/api/config` endpoint.

## Usage

### Web Dashboard

1. Open the dashboard at `http://localhost:3000`
2. **Registers** — View all coils, discrete inputs, holding registers, and input registers. Toggle coils or edit holding register values directly.
3. **Logs** — Monitor all Modbus communication in real time.
4. **Settings** — Configure the TCP port, RTU serial port path, and serial parameters. Changes take effect immediately after restarting the servers.

### Connect with a Modbus Client

**Modbus TCP (using [modbus-serial](https://github.com/yaacov/node-modbus-serial)):**

```javascript
const { ModbusTCP } = require('modbus-serial');
const client = new ModbusTCP();
await client.connectTCP('127.0.0.1', { port: 502 });

// Read holding registers
const data = await client.readHoldingRegisters(0, 10);
console.log(data.data);

// Write a coil
await client.writeCoil(0, true);

client.close();
```

**Modbus RTU (serial port):**

Configure the RTU serial path (e.g., `COM3` on Windows, `/dev/ttyUSB0` on Linux) in the dashboard settings, then connect with any standard Modbus RTU client.

## API Reference

All API routes are prefixed with `/api` and require the dev server to be running.

| Method | Endpoint            | Description                                                                |
| ------ | ------------------- | -------------------------------------------------------------------------- |
| GET    | `/api/registers`    | Dump full Modbus engine state                                              |
| POST   | `/api/registers`    | Write a coil or holding register. Body: `{ registerType, address, value }` |
| GET    | `/api/logs`         | Get all communication logs                                                 |
| GET    | `/api/status`       | Server status: `{ tcp: boolean, rtu: boolean }`                            |
| GET    | `/api/config`       | Get current configuration                                                  |
| POST   | `/api/config`       | Update configuration and restart servers. Body: partial config object      |
| GET    | `/api/serial-ports` | List available serial ports                                                |

## Project Structure

```
modbus-simulator/
├── app/
│   ├── api/                    # Next.js API routes
│   │   ├── config/route.ts
│   │   ├── logs/route.ts
│   │   ├── registers/route.ts
│   │   ├── serial-ports/route.ts
│   │   └── status/route.ts
│   ├── globals.css             # Tailwind CSS v4 entry + theme variables
│   ├── layout.tsx              # Root layout with i18n & theme
│   └── page.tsx                # Dashboard page (client component)
├── src/
│   ├── hooks/
│   │   ├── useModbusData.ts    # React hook for polling Modbus data
│   │   └── useTheme.ts         # Theme (light/dark/system) management
│   ├── i18n/
│   │   └── index.ts            # i18next initialization (EN / CN)
│   ├── lib/
│   │   └── modbus/
│   │       ├── engine.ts       # Singleton ModbusEngine (state + events)
│   │       ├── engine.test.ts  # Unit tests for engine
│   │       ├── index.ts        # Server manager (start/stop/config)
│   │       ├── mock-client.ts  # Mock client for E2E tests
│   │       ├── rtu-serial-server.ts  # Modbus RTU serial server
│   │       └── tcp-server.ts   # Modbus TCP server
│   └── types/
│       └── modbus-serial.d.ts  # Custom type declarations
├── e2e/                        # Playwright E2E tests
├── public/locales/             # Translation JSON files
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

| Script               | Description                                         |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Start development server with Turbopack (port 3000) |
| `npm run build`      | Production build                                    |
| `npm run start`      | Start production server                             |
| `npm run lint`       | Run ESLint                                          |
| `npm run format`     | Format all files with Prettier                      |
| `npm run type-check` | Run TypeScript compiler (no emit)                   |
| `npm run test:unit`  | Run Vitest unit tests                               |
| `npm run test:e2e`   | Run Playwright E2E tests                            |
| `npm run test`       | Run unit tests then E2E tests                       |

## License

[MIT](LICENSE)
