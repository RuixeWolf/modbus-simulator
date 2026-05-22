<div align="center">

# Modbus 设备模拟器

<p>
  <a href="../README.md">English</a> |
  <a href="README_FR.md">Français</a> |
  <a href="README_JA.md">日本語</a>
</p>

一款支持 Modbus TCP / RTU 串口的设备模拟器，配有实时 Web 仪表板。

> **Vibe Coding** — 本项目绝大部分功能通过 AI 辅助编程实现。

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 项目简介

**Modbus 设备模拟器** 是一款基于现代 Web 技术构建的全栈 Modbus 设备模拟工具。它同时运行 **Modbus TCP 服务器** 和 **RTU 串口服务器**，由高性能单例状态引擎驱动，并通过实时 Web 仪表板提供寄存器监控与控制、通信日志查看、服务器配置等功能。

无论您正在开发 Modbus 客户端应用、测试 PLC 集成，还是学习 Modbus 协议，本模拟器都能提供一个轻量级、零硬件的解决方案。

## 功能特性

- **双协议支持**
  - **Modbus TCP 服务器** — 端口可配置（默认 502），支持活跃客户端追踪
  - **Modbus RTU 串口服务器** — 真实串口集成，支持配置波特率、校验位、数据位和停止位
- **完整寄存器覆盖**
  - 1,000 线圈（Coils，可读写的布尔值）
  - 1,000 离散量输入（Discrete Inputs，只读布尔值）
  - 10,000 保持寄存器（Holding Registers，可读写的 16 位值）
  - 10,000 输入寄存器（Input Registers，只读 16 位值）
- **实时仪表板**
  - 带分页和地址跳转的实时寄存器表格
  - 直接在 UI 上切换线圈状态、写入保持/输入寄存器值
  - **高级寄存器写入** — 使用数据类型（UInt8、Int16BE、FloatBE、DoubleLE 等）或原始十六进制字节串写入多寄存器数值
  - 倒序排列的通信日志（最新的在前）
  - 可配置的日志过滤（读 / 写 / 错误 / 连接）
  - 服务器状态、活跃 TCP 客户端和配置面板
- **通信日志**
  - 内存日志缓冲区，最大数量可配置（100–10,000 条）
  - 记录请求、响应、错误和 TCP 连接事件
  - 每条日志附带来源标注（TCP、串口或 Web）
- **国际化**
  - 支持英文、中文、法文和日文
- **主题支持**
  - 亮色 / 暗色 / 跟随系统
- **REST API**
  - 完整的 HTTP API，便于外部集成和自动化，支持批量寄存器写入

### Web 仪表板

![Web 仪表板](./screenshots/web-dashboard.png)

## 技术栈

| 层级       | 技术                                                                  |
| ---------- | --------------------------------------------------------------------- |
| 框架       | [Next.js](https://nextjs.org/) 16（App Router）                       |
| UI 库      | [React](https://react.dev/) 19                                        |
| 组件库     | [HeroUI](https://www.heroui.com/) v3                                  |
| 样式       | [Tailwind CSS](https://tailwindcss.com/) v4                           |
| 语言       | [TypeScript](https://www.typescriptlang.org/)                         |
| Modbus TCP | [modbus-serial](https://github.com/yaacov/node-modbus-serial)         |
| Modbus RTU | [serialport](https://serialport.io/) + 自定义帧解析器                 |
| 测试       | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) |
| 图标       | [Iconify](https://iconify.design/)（Lucide）                          |
| 动画       | [Framer Motion](https://www.framer.com/motion/)                       |

## 快速开始

### 使用 NPX 运行（无需安装）

最快的方式上手 — 无需克隆或安装：

```bash
npx @ruixe/modbus-simulator@latest
```

带参数运行：

```bash
npx @ruixe/modbus-simulator@latest -p 8080 -t 5020 -o
```

查看所有可用选项：

```bash
npx @ruixe/modbus-simulator@latest --help
```

### 环境要求

- [Node.js](https://nodejs.org/) 20.6 或更高版本
- [npm](https://www.npmjs.com/) 或 [pnpm](https://pnpm.io/)

### 安装

```bash
# 克隆仓库
git clone https://github.com/RuixeWolf/modbus-simulator.git
cd modbus-simulator

# 安装依赖
npm install
# 或
pnpm install
```

### 开发

```bash
# 启动开发服务器（默认端口 5000）
npm run dev
```

在浏览器中打开 [http://localhost:5000](http://localhost:5000)。

Modbus TCP 服务器会自动在端口 `502` 启动（或按配置端口启动）。RTU 串口服务器仅在配置了串口路径后才会启动。

### 生产构建

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

## 配置说明

在项目根目录创建 `.env.local` 文件来自定义设置：

```bash
# Next.js 开发服务器端口（默认为 5000）
PORT=5000

# Modbus TCP 端口（生产环境使用；开发服务器始终从 502 启动 TCP）
MODBUS_TCP_PORT=502
```

服务器设置（TCP 端口、从站 ID、RTU 串口路径、波特率、校验位、日志过滤、日志最大数量等）也可以在运行时通过 Web 仪表板或 `/api/config` 接口进行修改。

## 使用说明

### Web 仪表板

1. 打开仪表板 `http://localhost:5000`
2. **寄存器** — 查看所有线圈、离散量输入、保持寄存器和输入寄存器。直接切换线圈状态或编辑寄存器值。使用**高级写入**功能进行多寄存器类型化数值或原始十六进制字节写入。
3. **日志** — 实时监控所有 Modbus 通信。按日志类型过滤，并可按需清空日志。
4. **设置** — 配置 TCP 端口、从站 ID、RTU 串口路径、串口参数、日志过滤和日志最大数量。修改后重启服务器即可生效。

### 使用 Modbus 客户端连接

**Modbus TCP（使用 [modbus-serial](https://github.com/yaacov/node-modbus-serial)）：**

```javascript
const { ModbusTCP } = require('modbus-serial')
const client = new ModbusTCP()
await client.connectTCP('127.0.0.1', { port: 502 })

// 读取保持寄存器
const data = await client.readHoldingRegisters(0, 10)
console.log(data.data)

// 写入线圈
await client.writeCoil(0, true)

client.close()
```

**Modbus RTU（串口）：**

在仪表板设置中配置 RTU 串口路径（例如 Windows 上的 `COM3`，Linux 上的 `/dev/ttyUSB0`），然后使用任何标准 Modbus RTU 客户端连接即可。

## API 文档

所有 API 路由均以 `/api` 为前缀，需要开发服务器在运行中。

| 方法   | 接口                   | 说明                                                                                                                                 |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/registers`       | 获取完整的 Modbus 引擎状态                                                                                                           |
| POST   | `/api/registers`       | 写入线圈或寄存器。请求体：`{ registerType, address, value }`                                                                         |
| POST   | `/api/registers/batch` | 批量写入寄存器。请求体：`{ registerType, startAddress, mode, dataType, value }` 或 `{ registerType, startAddress, mode, hexString }` |
| GET    | `/api/logs`            | 获取所有通信日志                                                                                                                     |
| DELETE | `/api/logs`            | 清空所有通信日志                                                                                                                     |
| GET    | `/api/status`          | 服务器状态：`{ tcp: boolean, rtu: boolean }`                                                                                         |
| GET    | `/api/config`          | 获取当前配置（包含 `logFilter` 和 `logMaxCount`）                                                                                    |
| POST   | `/api/config`          | 更新配置并重启服务器。请求体：部分配置对象                                                                                           |
| GET    | `/api/serial-ports`    | 列出可用串口                                                                                                                         |
| GET    | `/api/tcp-clients`     | 列出活跃的 TCP 客户端连接                                                                                                            |
| GET    | `/api/tcp-clients/:id` | 获取指定 TCP 客户端的详细信息                                                                                                        |

### 批量写入 API

批量写入接口支持两种模式：

**数字模式** — 使用数据类型将数值转换为寄存器值：

```bash
curl -X POST http://localhost:5000/api/registers/batch \
  -H "Content-Type: application/json" \
  -d '{
    "registerType": "holdingRegister",
    "startAddress": 0,
    "mode": "number",
    "dataType": "FloatBE",
    "value": 3.14
  }'
```

支持的数据类型：`UInt8`、`UInt16BE`、`UInt16LE`、`UInt32BE`、`UInt32LE`、`UIntBE`、`UIntLE`、`Int8`、`Int16BE`、`Int16LE`、`Int32BE`、`Int32LE`、`IntBE`、`IntLE`、`FloatBE`、`FloatLE`、`Float1234`、`Float2143`、`Float3412`、`Float4321`、`DoubleBE`、`DoubleLE`。

**字节模式** — 从十六进制字符串写入原始字节：

```bash
curl -X POST http://localhost:5000/api/registers/batch \
  -H "Content-Type: application/json" \
  -d '{
    "registerType": "holdingRegister",
    "startAddress": 10,
    "mode": "bytes",
    "hexString": "0A 45 B1 30"
  }'
```

## 项目结构

```
modbus-simulator/
├── app/
│   ├── api/                    # Next.js API 路由
│   │   ├── config/route.ts
│   │   ├── logs/route.ts
│   │   ├── registers/route.ts
│   │   ├── registers/batch/route.ts
│   │   ├── serial-ports/route.ts
│   │   ├── status/route.ts
│   │   ├── tcp-clients/route.ts
│   │   └── tcp-clients/[id]/route.ts
│   ├── globals.css             # Tailwind CSS v4 入口 + 主题变量
│   ├── layout.tsx              # 根布局，包含 i18n 和主题
│   └── page.tsx                # 仪表板页面（客户端组件）
├── src/
│   ├── components/
│   │   ├── AdvancedWriteModal.tsx   # 高级多寄存器写入弹窗
│   │   ├── LanguageSwitcher.tsx     # 语言切换器
│   │   ├── LogPanel.tsx             # 通信日志面板
│   │   ├── RegisterTable.tsx        # 带分页的寄存器表格
│   │   ├── SettingsPanel.tsx        # 服务器设置面板
│   │   ├── StatusIndicator.tsx      # 服务器状态指示器
│   │   ├── TcpClientPanel.tsx       # 活跃 TCP 客户端列表
│   │   └── ThemeToggle.tsx          # 亮/暗/系统主题切换
│   ├── hooks/
│   │   ├── useModbusData.ts    # 轮询 Modbus 数据的 React Hook
│   │   └── useTheme.ts         # 主题管理（亮色/暗色/系统）
│   ├── i18n/
│   │   └── index.ts            # i18next 初始化（英文 / 中文 / 法文 / 日文）
│   ├── lib/
│   │   └── modbus/
│   │       ├── buffer-convert.ts     # 数据类型与缓冲区转换
│   │       ├── engine.ts             # 单例 ModbusEngine（状态 + 事件）
│   │       ├── engine.test.ts        # 引擎单元测试
│   │       ├── index.ts              # 服务器管理（启动/停止/配置）
│   │       ├── log-context.ts        # 日志来源上下文的 AsyncLocalStorage
│   │       ├── mock-client.ts        # E2E 测试用的模拟客户端
│   │       ├── rtu-serial-server.ts  # Modbus RTU 串口服务器
│   │       └── tcp-server.ts         # Modbus TCP 服务器
│   └── types/
│       └── modbus-serial.d.ts  # 自定义类型声明
├── docs/                       # 文档和截图
├── e2e/                        # Playwright 端到端测试
├── public/locales/             # 翻译 JSON 文件（en、zh、fr、ja）
├── next.config.ts
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

## 测试

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

## 可用脚本

| 脚本                 | 说明                                 |
| -------------------- | ------------------------------------ |
| `npm run dev`        | 启动开发服务器（默认端口 5000）      |
| `npm run build`      | 生产构建                             |
| `npm run start`      | 启动生产服务器                       |
| `npm run lint`       | 运行 ESLint                          |
| `npm run format`     | 使用 Prettier 格式化所有文件         |
| `npm run type-check` | 运行 TypeScript 编译器（不输出文件） |
| `npm run test:unit`  | 运行 Vitest 单元测试                 |
| `npm run test:e2e`   | 运行 Playwright 端到端测试           |
| `npm run test`       | 先运行单元测试，再运行端到端测试     |

## 开源协议

[MIT](LICENSE)
