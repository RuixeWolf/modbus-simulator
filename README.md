<div align="center">

# Modbus Device Simulator

<p>
  <a href="#english">English</a> | <a href="#chinese">中文</a>
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

<a id="english"></a>

## English

### Overview

**Modbus Device Simulator** is a full-stack Modbus device simulator built with modern web technologies. It runs both a **Modbus TCP server** and an **RTU serial server** backed by a high-performance singleton state engine, and exposes a real-time web dashboard for monitoring and controlling registers, viewing communication logs, and configuring server settings.

Whether you are developing Modbus client applications, testing PLC integrations, or learning the Modbus protocol, this simulator provides a lightweight, zero-hardware solution.

### Features

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

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js](https://nextjs.org/) 16 (App Router) |
| UI Library | [React](https://react.dev/) 19 |
| Components | [HeroUI](https://www.heroui.com/) v3 |
| Styling | [Tailwind CSS](https://tailwindcss.com/) v4 |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Modbus TCP | [modbus-serial](https://github.com/yaacov/node-modbus-serial) |
| Modbus RTU | [serialport](https://serialport.io/) + custom frame parser |
| Testing | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) |
| Icons | [Iconify](https://iconify.design/) (Lucide) |
| Animation | [Framer Motion](https://www.framer.com/motion/) |

### Screenshots

> _Screenshots will be added here before release._
>
> - Dashboard overview
> - Register tables with pagination
> - Communication logs panel
> - Server configuration

### Quick Start

#### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

#### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/modbus-simulator.git
cd modbus-simulator

# Install dependencies
npm install
# or
pnpm install
```

#### Development

```bash
# Start the development server (default port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The Modbus TCP server starts automatically on port `502` (or as configured). The RTU serial server starts only when a serial port path is configured.

#### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Configuration

Create a `.env.local` file in the project root to customize settings:

```bash
# Next.js dev server port (default is 3000)
PORT=3000

# Modbus TCP port (used in production; dev server always starts TCP on 502)
MODBUS_TCP_PORT=502
```

Server settings (TCP port, RTU serial path, baud rate, parity, etc.) can also be changed at runtime via the web dashboard or the `/api/config` endpoint.

### Usage

#### Web Dashboard

1. Open the dashboard at `http://localhost:3000`
2. **Registers** — View all coils, discrete inputs, holding registers, and input registers. Toggle coils or edit holding register values directly.
3. **Logs** — Monitor all Modbus communication in real time.
4. **Settings** — Configure the TCP port, RTU serial port path, and serial parameters. Changes take effect immediately after restarting the servers.

#### Connect with a Modbus Client

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

### API Reference

All API routes are prefixed with `/api` and require the dev server to be running.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/registers` | Dump full Modbus engine state |
| POST | `/api/registers` | Write a coil or holding register. Body: `{ registerType, address, value }` |
| GET | `/api/logs` | Get all communication logs |
| GET | `/api/status` | Server status: `{ tcp: boolean, rtu: boolean }` |
| GET | `/api/config` | Get current configuration |
| POST | `/api/config` | Update configuration and restart servers. Body: partial config object |
| GET | `/api/serial-ports` | List available serial ports |

### Project Structure

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

### Testing

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

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with Turbopack (port 3000) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format all files with Prettier |
| `npm run type-check` | Run TypeScript compiler (no emit) |
| `npm run test:unit` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test` | Run unit tests then E2E tests |

### License

[MIT](LICENSE)

---

<a id="chinese"></a>

## 中文

### 项目简介

> **Vibe Coding** — 本项目绝大部分功能通过 AI 辅助编程实现。

**Modbus 设备模拟器** 是一款基于现代 Web 技术构建的全栈 Modbus 设备模拟工具。它同时运行 **Modbus TCP 服务器** 和 **RTU 串口服务器**，由高性能单例状态引擎驱动，并通过实时 Web 仪表板提供寄存器监控与控制、通信日志查看、服务器配置等功能。

无论您正在开发 Modbus 客户端应用、测试 PLC 集成，还是学习 Modbus 协议，本模拟器都能提供一个轻量级、零硬件的解决方案。

### 功能特性

- **双协议支持**
  - **Modbus TCP 服务器** — 端口可配置（默认 502）
  - **Modbus RTU 串口服务器** — 真实串口集成，支持配置波特率、校验位、数据位和停止位
- **完整寄存器覆盖**
  - 1,000 线圈（Coils，可读写的布尔值）
  - 1,000 离散量输入（Discrete Inputs，只读布尔值）
  - 10,000 保持寄存器（Holding Registers，可读写的 16 位值）
  - 10,000 输入寄存器（Input Registers，只读 16 位值）
- **实时仪表板**
  - 带分页的实时寄存器表格
  - 直接在 UI 上切换线圈状态、写入保持寄存器值
  - 倒序排列的通信日志（最新的在前）
  - 服务器状态与配置面板
- **通信日志**
  - 内存日志缓冲区（最多 1,000 条）
  - 记录请求、响应和错误信息
- **国际化**
  - 支持英文和中文
- **主题支持**
  - 亮色 / 暗色 / 跟随系统
- **REST API**
  - 完整的 HTTP API，便于外部集成和自动化

### 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | [Next.js](https://nextjs.org/) 16（App Router） |
| UI 库 | [React](https://react.dev/) 19 |
| 组件库 | [HeroUI](https://www.heroui.com/) v3 |
| 样式 | [Tailwind CSS](https://tailwindcss.com/) v4 |
| 语言 | [TypeScript](https://www.typescriptlang.org/) |
| Modbus TCP | [modbus-serial](https://github.com/yaacov/node-modbus-serial) |
| Modbus RTU | [serialport](https://serialport.io/) + 自定义帧解析器 |
| 测试 | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) |
| 图标 | [Iconify](https://iconify.design/)（Lucide） |
| 动画 | [Framer Motion](https://www.framer.com/motion/) |

### 截图预览

> _正式发布前将在此处添加截图。_
>
> - 仪表板总览
> - 带分页的寄存器表格
> - 通信日志面板
> - 服务器配置界面

### 快速开始

#### 环境要求

- [Node.js](https://nodejs.org/) 20 或更高版本
- [npm](https://www.npmjs.com/) 或 [pnpm](https://pnpm.io/)

#### 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/modbus-simulator.git
cd modbus-simulator

# 安装依赖
npm install
# 或
pnpm install
```

#### 开发

```bash
# 启动开发服务器（默认端口 3000）
npm run dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000)。

Modbus TCP 服务器会自动在端口 `502` 启动（或按配置端口启动）。RTU 串口服务器仅在配置了串口路径后才会启动。

#### 生产构建

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

### 配置说明

在项目根目录创建 `.env.local` 文件来自定义设置：

```bash
# Next.js 开发服务器端口（默认为 3000）
PORT=3000

# Modbus TCP 端口（生产环境使用；开发服务器始终从 502 启动 TCP）
MODBUS_TCP_PORT=502
```

服务器设置（TCP 端口、RTU 串口路径、波特率、校验位等）也可以在运行时通过 Web 仪表板或 `/api/config` 接口进行修改。

### 使用说明

#### Web 仪表板

1. 打开仪表板 `http://localhost:3000`
2. **寄存器** — 查看所有线圈、离散量输入、保持寄存器和输入寄存器。直接切换线圈状态或编辑保持寄存器值。
3. **日志** — 实时监控所有 Modbus 通信。
4. **设置** — 配置 TCP 端口、RTU 串口路径及串口参数。修改后重启服务器即可生效。

#### 使用 Modbus 客户端连接

**Modbus TCP（使用 [modbus-serial](https://github.com/yaacov/node-modbus-serial)）：**

```javascript
const { ModbusTCP } = require('modbus-serial');
const client = new ModbusTCP();
await client.connectTCP('127.0.0.1', { port: 502 });

// 读取保持寄存器
const data = await client.readHoldingRegisters(0, 10);
console.log(data.data);

// 写入线圈
await client.writeCoil(0, true);

client.close();
```

**Modbus RTU（串口）：**

在仪表板设置中配置 RTU 串口路径（例如 Windows 上的 `COM3`，Linux 上的 `/dev/ttyUSB0`），然后使用任何标准 Modbus RTU 客户端连接即可。

### API 文档

所有 API 路由均以 `/api` 为前缀，需要开发服务器在运行中。

| 方法 | 接口 | 说明 |
|------|------|------|
| GET | `/api/registers` | 获取完整的 Modbus 引擎状态 |
| POST | `/api/registers` | 写入线圈或保持寄存器。请求体：`{ registerType, address, value }` |
| GET | `/api/logs` | 获取所有通信日志 |
| GET | `/api/status` | 服务器状态：`{ tcp: boolean, rtu: boolean }` |
| GET | `/api/config` | 获取当前配置 |
| POST | `/api/config` | 更新配置并重启服务器。请求体：部分配置对象 |
| GET | `/api/serial-ports` | 列出可用串口 |

### 项目结构

```
modbus-simulator/
├── app/
│   ├── api/                    # Next.js API 路由
│   │   ├── config/route.ts
│   │   ├── logs/route.ts
│   │   ├── registers/route.ts
│   │   ├── serial-ports/route.ts
│   │   └── status/route.ts
│   ├── globals.css             # Tailwind CSS v4 入口 + 主题变量
│   ├── layout.tsx              # 根布局，包含 i18n 和主题
│   └── page.tsx                # 仪表板页面（客户端组件）
├── src/
│   ├── hooks/
│   │   ├── useModbusData.ts    # 轮询 Modbus 数据的 React Hook
│   │   └── useTheme.ts         # 主题管理（亮色/暗色/系统）
│   ├── i18n/
│   │   └── index.ts            # i18next 初始化（英文 / 中文）
│   ├── lib/
│   │   └── modbus/
│   │       ├── engine.ts       # 单例 ModbusEngine（状态 + 事件）
│   │       ├── engine.test.ts  # 引擎单元测试
│   │       ├── index.ts        # 服务器管理（启动/停止/配置）
│   │       ├── mock-client.ts  # E2E 测试用的模拟客户端
│   │       ├── rtu-serial-server.ts  # Modbus RTU 串口服务器
│   │       └── tcp-server.ts   # Modbus TCP 服务器
│   └── types/
│       └── modbus-serial.d.ts  # 自定义类型声明
├── e2e/                        # Playwright 端到端测试
├── public/locales/             # 翻译 JSON 文件
├── next.config.ts
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

### 测试

```bash
# 运行单元测试（Vitest）
npm run test:unit

# 运行端到端测试（Playwright）
npm run test:e2e

# 运行全部测试
npm run test

# 运行指定的单元测试文件
npx vitest run src/lib/modbus/engine.test.ts

# 运行指定的端到端测试
npx playwright test e2e/modbus.spec.ts --grep "UI to Protocol"
```

### 可用脚本

| 脚本 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（带 Turbopack，端口 3000） |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint |
| `npm run format` | 使用 Prettier 格式化所有文件 |
| `npm run type-check` | 运行 TypeScript 编译器（不输出文件） |
| `npm run test:unit` | 运行 Vitest 单元测试 |
| `npm run test:e2e` | 运行 Playwright 端到端测试 |
| `npm run test` | 先运行单元测试，再运行端到端测试 |

### 开源协议

[MIT](LICENSE)
