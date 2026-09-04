## Why

AI Agent 在开发和测试 Modbus 上位机软件时，目前只能依赖人工操作 Dashboard 或直接连接 Modbus TCP/串口，无法可靠地启动模拟器、等待服务就绪、配置传输方式、批量设置测试数据并读取诊断信息。项目需要一套稳定、可发现、可脚本化且默认安全的控制面，让 Agent 能完成可重复的端到端测试流程。

## What Changes

- 新增版本化 HTTP 控制 API `/api/v1` 与由运行时校验模型生成的 OpenAPI 文档，支持健康检查、完整状态快照、寄存器范围读写、编码值写入、状态重置、运行配置、日志、串口和 TCP 客户端管理。
- 新增统一运行时生命周期协调，准确报告 TCP/RTU 服务的启动、停止、错误和实际配置，并为 CLI 提供可机器解析的就绪或失败输出。
- 默认将 HTTP 控制面和 Modbus TCP 绑定到 `127.0.0.1`；非回环监听必须配置 Bearer Token，Dashboard 可在会话范围内输入 Token。
- 在项目根目录新增 `skills/modbus-simulator` Agent Skill，提供启动、等待就绪、配置、重置、读写和诊断的标准流程，以及无额外依赖的 `control.mjs` 辅助脚本。
- Skill 默认通过 `npx --yes @ruixe/modbus-simulator@latest` 启动模拟器，并使用高位 HTTP/Modbus TCP 端口避免与本地服务冲突。
- **BREAKING**：一次性移除未版本化的旧 `/api/*` 接口，不提供兼容别名；Dashboard 和文档同步迁移到 `/api/v1`。
- **BREAKING**：Modbus TCP 默认绑定地址从所有网络接口改为回环地址；需要局域网或容器访问时必须显式配置监听地址和认证。
- 将 npm 包版本发布为 `1.1.0`，并提供明确的迁移文档和发布前验证门禁。
- MCP 不在本次实现范围内；待 HTTP API 稳定后，可另行实现只依赖该 API 的 stdio 适配器。

## Capabilities

### New Capabilities

- `versioned-control-api`: 定义可发现、严格校验、可认证的 HTTP v1 控制面及其状态、寄存器、配置、日志和连接管理行为。
- `automation-runtime-lifecycle`: 定义模拟器启动、传输服务状态、运行时重配置、机器可读就绪输出和安全监听策略。
- `modbus-simulator-agent-skill`: 定义可通过 Skills CLI 安装的 Agent Skill、控制辅助脚本和推荐自动化工作流。

### Modified Capabilities

无。

## Impact

- API 路由、Dashboard 数据访问层、Modbus 引擎日志与重置能力、TCP/RTU 服务生命周期、CLI 参数解析和启动脚本均会调整。
- 新增直接生产依赖 Zod 4 和 `zod-openapi`，以运行时 Schema 作为校验与 OpenAPI 生成的单一事实来源。
- README 多语言文档、API 参考、迁移指南、四种语言的界面文案、单元测试和 Playwright 端到端测试需要同步更新。
- npm 发布流程需要在版本变更触发发布前执行格式检查、类型检查、单元测试、端到端测试和发布包预检。
- 根目录 `skills/` 仅通过 GitHub/Skills CLI 分发，不打入 npm 发布包；npm 包版本固定为 `1.1.0`。
