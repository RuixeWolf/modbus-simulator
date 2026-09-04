## Context

见 [proposal.md](proposal.md) 的动机。本项目当前由 `ModbusEngine` 单例保存四类数据表，Next.js Route Handlers、Dashboard、Modbus TCP 和 RTU 共享这份状态。现有未版本化 REST 路由由各处理器自行解析请求，`GET /api/registers` 每秒向 Dashboard 返回约 22,000 个条目；服务启动状态又分别保存在 TCP/RTU 包装类中，TCP 在监听成功前就可能被标记为 running。

启动入口同时存在于根 `instrumentation.ts` 和各 API 模块的模块级 `ensureServersStarted()`。服务器配置在模块加载时读取环境变量，运行时重配置采用直接停止/启动方式。CLI 由 `scripts/dev.mjs` 包装 Next.js，现有宽松参数解析不适合 Agent 判断非法参数和真实 readiness。

本次设计必须保留 Next.js 16 App Router、引擎单例、Dashboard 一秒轮询、Node.js 20 运行时以及 `modbus-serial`/`serialport` 服务端依赖等约束。规划遵循三个能力规格：`versioned-control-api`、`automation-runtime-lifecycle` 和 `modbus-simulator-agent-skill`。

## Goals / Non-Goals

**Goals:**

- 建立一个 Agent 和 Dashboard 共用、可从 OpenAPI 发现的 v1 控制面，并让运行时 Schema 同时驱动校验和文档。
- 把传输生命周期收敛为一个进程级协调器，使启动、重启、失败和 readiness 有唯一可信状态。
- 在回环本地开发保持零配置，同时防止用户无意中暴露未认证的控制面。
- 提供可从仓库安装的 Skill 和无依赖 helper，覆盖完整自动化测试闭环。
- 用测试和发布门禁保障一次性 API 迁移，并按用户指定发布 `1.1.0`。

**Non-Goals:**

- 本次不实现 MCP Server；未来 MCP 只作为 HTTP v1 的 stdio 适配器，不形成第二套业务实现。
- 不把 Dashboard 改为 SSE/WebSocket，也不把每个页面重构为按需范围轮询；Dashboard 继续使用完整快照接口。
- 不改变 Modbus 协议行为、寄存器容量、现有编码类型名称或引擎的进程内持久化模型。
- 不提供旧未版本化 API 的兼容窗口、重定向或代理层。
- Skill 不负责通用进程管理，也不把 Agent Skill 文件复制进 npm 包。

## Decisions

### 1. REST v1 是唯一控制面，OpenAPI 由运行时 Schema 生成

先实现 `/api/v1` REST API。它同时适用于 Shell/Node Agent、Dashboard、CI 和未来 MCP，调试与部署成本最低。新增 Zod 4 和 `zod-openapi` 作为直接生产依赖；请求、响应与错误 Schema 放在 `src/lib/modbus/control/schemas.ts`，OpenAPI 从相同 Schema 注册生成，避免手写文档漂移。

备选方案是直接实现 MCP 或同时维护 REST/MCP。前者无法自然服务 Dashboard 和普通测试程序，后者会在领域行为稳定前造成两套入口和双倍测试面，因此推迟 MCP。

路由矩阵如下：

| Method     | Path                                | 用途                       |
| ---------- | ----------------------------------- | -------------------------- |
| GET        | `/api/v1`                           | 发现 API 与文档链接        |
| GET        | `/api/v1/openapi.json`              | OpenAPI 3 文档             |
| GET        | `/api/v1/health`                    | 实例、readiness 与传输状态 |
| GET        | `/api/v1/state`                     | Dashboard 完整状态快照     |
| POST       | `/api/v1/state/reset`               | 全部或选择性重置           |
| GET/PUT    | `/api/v1/registers/{table}`         | 有界连续范围读写           |
| PUT        | `/api/v1/registers/{table}/encoded` | 编码数值/十六进制写入      |
| GET/PATCH  | `/api/v1/config`                    | 读取和修改运行配置         |
| GET/DELETE | `/api/v1/logs`                      | 游标日志和清空             |
| GET        | `/api/v1/serial-ports`              | 串口枚举                   |
| GET/DELETE | `/api/v1/tcp-clients`               | 枚举或断开全部客户端       |
| DELETE     | `/api/v1/tcp-clients/{id}`          | 断开指定客户端             |

公开表名固定为 `coils`、`discrete-inputs`、`holding-registers`、`input-registers`。范围读取使用 `start` 和 `count` 查询参数；范围写入使用 `{ start, values }`。编码写入使用判别联合：数据类型模式为 `{ address, dataType, value }`，字节模式为 `{ address, bytes: "...hex..." }`。数据类型名称保留项目现有 UInt/Int/Float/Double 大小端和字序名称。

### 2. Route Handler 共用适配层，领域服务不依赖 HTTP

新增 `src/lib/api/control-handler.ts` 的 `withControlApi` 包装器，统一完成 Host/Origin、Bearer Token、JSON 解析、Zod 校验、错误映射、信封和 `no-store` 响应头。鉴权不只依赖 Next.js Proxy/Middleware，因为 Route Handler 可能被不同部署方式直接调用。

领域操作集中在 `src/lib/modbus/control/service.ts`：路由只做传输适配，Service 调用引擎、生命周期协调器和连接管理器。`src/lib/modbus/control/errors.ts` 定义稳定错误码与 HTTP 映射。这样未来 MCP 可以直接调用 HTTP，或在确有必要时复用无 HTTP 状态的领域模型，而不复制校验规则。

成功信封为 `{ data, meta: { apiVersion: "1", instanceId } }`，失败信封为 `{ error: { code, message, issues? }, meta }`。错误消息和错误码固定使用英文，Dashboard 再按错误码本地化。

### 3. 控制 API 使用严格、原子且有界的状态操作

控制 API 不沿用引擎内部 `value & 0xffff` 的宽松语义。外部请求先完整验证地址、数量和全部值：布尔表只接受 boolean，寄存器只接受 `0..65535` 整数；范围和日志单次上限均为 1000；对象拒绝未知字段。验证完成后在同一同步临界段提交全部值，任何错误都不产生部分写入。

引擎新增实例级 reset 操作，不复用仅供单元测试销毁全局单例的 `resetInstance()`。reset 默认清空四表但保留日志；`clearLogs` 由调用方显式选择，配置与现有连接不受影响。

Dashboard 暂时迁移到 `/api/v1/state` 的完整快照，避免 API 迁移、安全提示和页面数据模型重构同时发生。Agent 一律使用范围接口以减少响应体。备选方案是此次把 Dashboard 全面切为分页/范围请求，但收益不足以抵消回归面。

### 4. 日志使用实例内单调游标

日志记录增加 `id`、`system` 类型和 `api` 来源。ID 在实例内单调递增；清空日志不重置计数器，只有新进程生成新 `instanceId` 时才允许从初值开始。`afterId` + `nextAfterId` 支持无重复轮询，`droppedBeforeId` 显式告知调用方其游标之前的记录已被容量淘汰。

API 写入通过现有 AsyncLocalStorage 日志上下文标记 `api`，生命周期协调器写入 `system` 事件。`DELETE /logs` 自身不记一条立即可见的清除日志，否则“清空后为空”的自动化断言不稳定。

### 5. 进程级 RuntimeCoordinator 是生命周期单一事实来源

在 `src/lib/modbus/lifecycle.ts`（或同一职责目录）新增通过 `globalThis` 跨 HMR 保存的 `RuntimeCoordinator`，包含：

- 稳定的 `instanceId`、`startedAt` 与 `startupPromise`；
- 串行 `transitionQueue`，协调启动、停止和配置应用；
- `desiredConfig`；
- TCP/RTU 各自的 state、actual config、lastTransitionAt 和 error。

TCP 只在 `modbus-serial` 的 `initialized`/底层 listen 成功后进入 running；`serverError` 进入 error。RTU 只在串口 open 成功后进入 running。`ensureServersStarted()` 变为幂等协调器入口；新路由继续在模块级调用 `void ensureServersStarted()` 作为兜底，根 `instrumentation.register()` 动态导入 Node-only 模块并等待一次初始启动尝试。

普通人类启动时，传输失败不让 instrumentation 抛出并杀死 Dashboard，而是保留 degraded 状态供修复。Agent Skill 始终使用 `--strict-ready`，在超时或启动错误时清理其子进程并非零退出。

### 6. 配置采用 desired/actual 模型且失败不回滚

`PATCH /api/v1/config` 首先原子校验完整 patch，再更新 desired config，计算 TCP/RTU 哪些字段受影响，最后在 transition queue 中仅重启相关传输。日志配置独立应用。TCP 重启造成的连接断开在 `effects` 中明确报告。

若新配置合法但无法应用（例如端口被占用），保留 desired config，并把 actual transport 标记为 error，返回非 2xx。这样 Agent 可以修正同一目标配置，且不会因隐式回滚误判实际环境。备选的自动回滚会隐藏期望值、回滚也可能失败，因此不采用。

### 7. 默认回环，非回环控制面强制 Token

HTTP host 和 Modbus TCP host 默认均改为 `127.0.0.1`。CLI 在服务启动前检查：若 HTTP 控制面绑定非回环地址，必须从 `MODBUS_API_TOKEN` 或 `--api-token-file` 获得非空 Token，否则拒绝启动。Token 不接受明文 CLI 参数，避免出现在进程列表；比较采用 constant-time 方法，且 readiness、日志和错误统一脱敏。

配置 Token 时，`/api/v1` 和 `/api/v1/openapi.json` 保持公开以便发现，其余端点全部要求 Bearer Token，包括 health。默认不返回开放 CORS 头，并在包装器中限制 Host/Origin。Dashboard 的集中 API client 遇到 401 时显示 Token 对话框，用 health 验证后只写入 `sessionStorage`，绝不进入 URL 或 `localStorage`。

Modbus TCP 本身没有采用该 HTTP Token 协议；把 TCP 默认绑定改为回环用于降低意外暴露风险。明确需要 LAN/Docker 的用户同时配置监听地址和控制面 Token，并在文档中承担网络边界安全配置。

### 8. CLI 提供严格参数和一行式 readiness 协议

扩展现有 `scripts/dev.mjs` 参数：`--host`、`--tcp-host`、`--api-token-file`、`--ready-output text|json`、`--ready-timeout`、`--strict-ready` 和 `--version`，保留已有端口、串口、slave ID 与 `--open`。改为严格解析，未知选项及非法端口/ID/主机/超时以退出码 2 结束。

JSON 协议只依赖一行前缀，便于任何 Agent 从混合子进程输出中稳定识别：

```text
MODBUS_SIMULATOR_READY {"packageVersion":"1.1.0","apiVersion":"1",...}
MODBUS_SIMULATOR_ERROR {"code":"...","message":"...",...}
```

READY 只能在 health 的必需服务真实 ready 后打印。普通模式可保持 degraded 进程运行；strict 模式超时/失败时终止由 CLI 创建的 Next 子进程并返回非零。

### 9. Skill 通过 GitHub 分发，helper 只做 HTTP 控制

新增结构：

```text
skills/modbus-simulator/
├── SKILL.md
├── references/
│   ├── api.md
│   ├── addressing.md
│   └── troubleshooting.md
└── scripts/
    └── control.mjs
```

`SKILL.md` 的默认命令固定为用户选择的 `npx --yes @ruixe/modbus-simulator@latest`，并明确 `@latest` 取执行时 registry 最新版本。示例使用 HTTP 15000、Modbus TCP 15020 等可替换高位端口。虽然变更发布版本是 `1.1.0`，Skill 不钉住 `@1.1`，后续兼容修复可由 `@latest` 自动获得。

`control.mjs` 仅使用 Node.js 20 `fetch`，提供 wait、health、reset、read、write、write-encoded、config、logs；Token 从环境变量读取。退出码约定为 0 成功、2 用法、3 网络、4 API、5 readiness timeout。它不启动或杀死进程，进程所有权由 Agent 工作流维护。

Skill 还记录 0 起始地址与常见 Modbus 人类地址映射、协议只读表的 fixture 写法、编码值、各平台串口、LAN/Docker 安全和排障。根 `skills/` 不加入 `scripts/publish.mjs` 的 npm 复制列表，使用 `npx skills add RuixeWolf/modbus-simulator --skill modbus-simulator` 从仓库安装。

### 10. 一次性迁移旧接口并发布 1.1.0

删除现有未版本化 Route Handler 目录，同时迁移 `src/hooks/useModbusData.ts`、少量 E2E 直连请求和所有 README API 示例。新增 `docs/MIGRATION_1.1.md` 列出旧到新端点、信封、地址校验、默认 bind 和认证变化。旧路由在测试中必须返回 404。

虽然移除 API 属于破坏性变化，版本号按用户决定固定为 `1.1.0`，不改为 2.0.0；必须通过 release notes 和迁移文档醒目标注。`package.json` 版本变更放在实现与验证完成后的最后一步，因为 main 分支上的版本差异会触发 OIDC 自动发布。

### 11. 验证覆盖控制面、跨协议闭环和分发产物

单元测试覆盖 reset、日志 ID、严格/原子写入、编码、认证、OpenAPI、生命周期 initialized/error/timeout/并发队列和配置失败 desired/actual。Route Handler 测试按领域拆分。

Playwright/集成测试使用独立高位端口完成：启动并等待 READY、reset/config、HTTP 写入后经 Modbus TCP 读取、Modbus TCP 写入后经 HTTP 读取、检查日志并清理自有进程。额外覆盖端口冲突 strict-ready、Token、秘密不泄露、非法请求无部分写、旧接口 404 和 Skill 发现/临时安装。

发布工作流在 publish 前串行通过 format/lint、type-check、unit、E2E 和 `publish:npm:dry-run`。该门禁既验证应用，也验证 `skills/` 未误入 npm tarball。

## Risks / Trade-offs

- [一次性移除旧 API 会立即破坏外部脚本] → 在 `1.1.0` 发布说明和 `MIGRATION_1.1.md` 提供完整映射，自动测试断言旧接口 404，避免出现半迁移状态。
- [使用 `@latest` 使 Skill 的运行版本随 registry 变化] → READY/health 校验 API 版本与能力，Skill 明示语义，并把 helper 限定在 v1 契约；若未来出现不兼容主版本再新增兼容检查。
- [完整 `/state` 轮询继续产生较大响应] → 先保证 Dashboard 低风险迁移，Agent 使用范围 API；后续单独度量并优化 UI 数据获取。
- [desired 配置失败后与 actual 不一致，用户可能困惑] → health、config 响应和 Dashboard 同时展示两者及错误，所有转换记录 system 日志。
- [Next.js HMR 或多个启动入口导致重复服务] → 协调器与启动 Promise 挂载到 `globalThis`，所有入口只调用同一幂等方法，测试并发启动。
- [Token 存在浏览器会话和环境中仍有泄漏面] → 禁止 CLI 明文参数、URL/localStorage 和日志输出，使用 sessionStorage、Header 和 constant-time 比较；文档要求将非回环部署置于可信网络边界。
- [TCP 监听默认改为回环影响 Docker/LAN 用户] → 提供显式 `--tcp-host`/环境配置和迁移示例，并在缺少控制面 Token 时拒绝危险配置。
- [Zod 与 OpenAPI 生成器增加包体和升级耦合] → 固定兼容依赖范围、从同一 Schema 生成文档并增加 schema 快照/行为测试，收益高于维护两套定义。

## Migration Plan

1. 在不删除旧路由的开发阶段先完成共享 Schema、错误模型、RuntimeCoordinator、v1 Service 与路由，并用新测试验证。
2. 迁移 Dashboard API client、Token 交互、四语文案和 E2E 流程到 v1。
3. 添加 Skill、helper、README 与 `MIGRATION_1.1.md`，验证 Skills CLI 能发现/安装且 npm dry-run 不包含 `skills/`。
4. 删除全部旧未版本化路由和引用，运行旧路由 404 断言及完整验证门禁。
5. 最后将 `package.json` 版本改为 `1.1.0`，检查生成的发布包与 release notes 后合并，由 main 发布流程发布。

若发布前需要回退，恢复旧版本号和旧路由提交即可。若 `1.1.0` 已发布，npm 包不可覆盖，应修复后发布新的补丁版本；必要时可把 npm dist-tag 指回上一稳定版本，但不在 `1.1.0` 中重新引入无版本兼容路由。
