## Purpose

为 Dashboard、测试程序和 AI Agent 提供稳定、可发现、严格校验且默认安全的 HTTP 控制契约，使调用方无需通过 Modbus 数据通道也能控制和观测模拟器。

## ADDED Requirements

### Requirement: Versioned API discovery and schema

系统 SHALL 在 `GET /api/v1` 提供 v1 控制面的发现信息，并在 `GET /api/v1/openapi.json` 提供与实际运行时校验规则一致的 OpenAPI 文档。这两个发现端点 SHALL 无需 Bearer Token 即可访问，并 SHALL 报告 API 版本 `1` 和软件包版本 `1.1.0`。

#### Scenario: Agent discovers the control API

- **WHEN** 调用方请求 `GET /api/v1`
- **THEN** 系统返回 API 版本、软件包版本以及健康检查和 OpenAPI 文档的链接

#### Scenario: Agent downloads the schema without credentials

- **WHEN** 已配置控制 API Token 且调用方未提供凭据请求 `GET /api/v1/openapi.json`
- **THEN** 系统仍返回描述实际 v1 请求、响应和错误模型的 OpenAPI 文档

### Requirement: Consistent responses and errors

所有 v1 成功响应 SHALL 使用 `{ data, meta }` 信封，所有失败响应 SHALL 使用 `{ error, meta }` 信封；`meta` SHALL 至少包含 `apiVersion: "1"` 和当前 `instanceId`。所有状态相关响应 SHALL 设置 `Cache-Control: no-store`。错误 SHALL 包含稳定的英文 `code`、英文 `message`，并在校验失败时包含可定位字段的 `issues`。

#### Scenario: Schema validation fails

- **WHEN** 调用方提交语法正确但不符合接口 Schema 的 JSON
- **THEN** 系统返回 HTTP 422，错误信封包含稳定错误码和字段级问题，且不改变任何模拟器状态

#### Scenario: Request body is malformed JSON

- **WHEN** 调用方提交无法解析的 JSON
- **THEN** 系统返回 HTTP 400 的标准错误信封

#### Scenario: Resource or runtime conflict occurs

- **WHEN** 一个合法请求与当前资源状态冲突
- **THEN** 系统返回 HTTP 409 的标准错误信封

#### Scenario: Runtime cannot satisfy an operation

- **WHEN** 控制面存在但运行时处于无法执行请求的降级状态
- **THEN** 系统返回 HTTP 503 的标准错误信封并保留可诊断的运行时状态

### Requirement: Operational endpoint authentication

当配置了控制 API Token 时，除 `GET /api/v1` 和 `GET /api/v1/openapi.json` 外的所有 `/api/v1` 端点 SHALL 要求 `Authorization: Bearer <token>`。系统 SHALL 拒绝错误或缺失的凭据，默认 SHALL 不开放跨域访问，并 SHALL 校验不可信的 Host 和 Origin。Token SHALL 不出现在响应、日志、错误或机器可读就绪输出中。

#### Scenario: Protected endpoint is called without a token

- **WHEN** 控制 API 已配置 Token 且调用方未携带 Token 请求 `GET /api/v1/health`
- **THEN** 系统返回 HTTP 401 且不泄露 Token 或比较细节

#### Scenario: Protected endpoint is called with a valid token

- **WHEN** 调用方以正确的 Bearer Token 请求受保护端点
- **THEN** 系统执行请求并返回标准成功信封

#### Scenario: Cross-origin request is not explicitly allowed

- **WHEN** 浏览器来源与模拟器控制面不匹配且项目未显式配置该来源
- **THEN** 系统拒绝请求且不返回允许该来源的 CORS 响应头

### Requirement: Full state snapshot

系统 SHALL 在 `GET /api/v1/state` 返回四类数据表的完整当前状态，供 Dashboard 初始化和轮询使用。快照 SHALL 包含 coils、discrete inputs、holding registers 和 input registers，并 SHALL 与范围读取所观察到的同一引擎状态一致。

#### Scenario: Dashboard reads a complete snapshot

- **WHEN** Dashboard 请求 `GET /api/v1/state`
- **THEN** 系统在单个响应中返回四类表的全部值和当前实例元数据

### Requirement: Deterministic state reset

系统 SHALL 在 `POST /api/v1/state/reset` 支持重置全部或指定数据表，并允许调用方显式选择是否清空日志。未指定表时 SHALL 重置全部数据表，未指定 `clearLogs` 时 SHALL 保留日志。重置 SHALL 将布尔表置为 `false`、寄存器表置为 `0`，且 SHALL 不改变运行配置或断开客户端。

#### Scenario: Agent starts a clean test

- **WHEN** Agent 请求重置全部表并设置 `clearLogs: true`
- **THEN** 所有表恢复默认值，既有日志被清空，运行配置和客户端连接保持不变

#### Scenario: Agent resets one table and keeps logs

- **WHEN** Agent 仅指定 holding registers 且省略 `clearLogs`
- **THEN** 系统仅将 holding registers 置零并保留日志和其他表

### Requirement: Bounded register range reads

系统 SHALL 在 `GET /api/v1/registers/{table}` 支持以 0 起始地址和数量读取连续范围，其中 `{table}` SHALL 为 `coils`、`discrete-inputs`、`holding-registers` 或 `input-registers`。地址和数量 SHALL 为整数、范围 SHALL 在对应表边界内，单次数量 SHALL 不超过 1000。

#### Scenario: Agent reads a valid range

- **WHEN** Agent 请求有效表中从地址 20 开始的 10 个值
- **THEN** 系统按地址顺序返回恰好 10 个值及所请求范围信息

#### Scenario: Range exceeds table boundary

- **WHEN** 请求的起始地址和数量超出目标表边界
- **THEN** 系统返回 HTTP 422 且不截断或部分返回范围

#### Scenario: Range exceeds the request limit

- **WHEN** 调用方请求超过 1000 个值
- **THEN** 系统返回 HTTP 422 并说明允许的上限

### Requirement: Atomic register range writes

系统 SHALL 在 `PUT /api/v1/registers/{table}` 支持从 0 起始地址写入连续值。coils 和 discrete inputs SHALL 只接受 JSON 布尔值；holding 和 input registers SHALL 只接受 `0..65535` 的整数。系统 SHALL 在写入前验证完整请求，并 SHALL 以全有或全无方式同步提交范围。

#### Scenario: Agent writes a valid boolean range

- **WHEN** Agent 向 coils 的有效起始地址提交布尔值数组
- **THEN** 系统原子写入全部值并返回已写入范围

#### Scenario: Register value is out of range

- **WHEN** 请求包含负数、大于 65535、非整数或错误类型的寄存器值
- **THEN** 系统返回 HTTP 422，范围中的任何值均不被写入

#### Scenario: A later item is invalid

- **WHEN** 范围中前面的值有效但后面的值或地址无效
- **THEN** 系统拒绝整个请求且所有原值保持不变

### Requirement: Encoded register writes

系统 SHALL 在 `PUT /api/v1/registers/{table}/encoded` 为 holding registers 和 input registers 提供多寄存器编码写入，支持现有 UInt、Int、Float、Double 的大小端/字序类型以及十六进制字节模式。系统 SHALL 在任何写入前校验编码类型、值、对齐、目标范围和最终 16 位字序列。

#### Scenario: Agent writes a floating-point fixture

- **WHEN** Agent 使用受支持的 Float 数据类型和值写入有效寄存器地址
- **THEN** 系统按所选字节序和字序原子写入对应的 16 位寄存器序列

#### Scenario: Encoded value does not fit

- **WHEN** 编码后的寄存器序列会超出目标表边界或输入无法按所选类型编码
- **THEN** 系统返回 HTTP 422 且不写入任何寄存器

#### Scenario: Encoded write targets a bit table

- **WHEN** 调用方对 coils 或 discrete inputs 请求编码写入
- **THEN** 系统返回 HTTP 404 或 422 且不改变状态

### Requirement: Filterable monotonic logs

系统 SHALL 在 `GET /api/v1/logs` 按递增且在当前实例内不复用的 `id` 返回日志，并支持 `afterId`、`limit`、`type` 和 `source` 过滤；单次 `limit` SHALL 不超过 1000。响应 SHALL 提供 `nextAfterId` 和 `droppedBeforeId`，使轮询方能够检测游标推进和因容量限制丢失的历史。日志 SHALL 支持系统生命周期事件及 `api` 来源。

#### Scenario: Agent polls incrementally

- **WHEN** Agent 使用上次的 `nextAfterId` 作为 `afterId` 请求日志
- **THEN** 系统仅返回更大的匹配日志 ID，并返回新的游标

#### Scenario: Old entries were evicted

- **WHEN** Agent 的 `afterId` 早于当前仍保留的最小日志 ID
- **THEN** 响应通过 `droppedBeforeId` 表明游标之前已有日志被丢弃

#### Scenario: Logs are cleared

- **WHEN** 调用方请求 `DELETE /api/v1/logs`
- **THEN** 系统删除当前日志但不重置下一条日志 ID，且清除操作本身不会立即新增一条系统日志

### Requirement: Runtime configuration and resource inspection

系统 SHALL 在 `GET` 和 `PATCH /api/v1/config` 提供当前期望配置、实际传输状态和变更效果；在 `GET /api/v1/serial-ports` 提供可用串口；在 `GET /api/v1/tcp-clients` 提供已连接客户端；并在 `DELETE /api/v1/tcp-clients` 或 `DELETE /api/v1/tcp-clients/{id}` 支持断开全部或指定 TCP 客户端。

#### Scenario: Agent inspects resources

- **WHEN** Agent 请求配置、串口或 TCP 客户端列表
- **THEN** 系统返回当前实例对应的可观测资源和状态

#### Scenario: Agent disconnects one TCP client

- **WHEN** Agent 使用存在的客户端 ID 请求单个断开
- **THEN** 系统仅断开该客户端并返回操作结果

#### Scenario: Agent disconnects an unknown TCP client

- **WHEN** Agent 请求断开不存在的客户端 ID
- **THEN** 系统返回 HTTP 404 且不影响其他连接

### Requirement: Legacy API removal

软件包版本 `1.1.0` SHALL 不再提供未版本化的旧 `/api/registers`、`/api/config`、`/api/status`、`/api/logs`、`/api/serial-ports` 和 `/api/tcp-clients` 接口，也 SHALL 不提供重定向或兼容别名。

#### Scenario: Legacy client calls an old route

- **WHEN** 客户端在 `1.1.0` 请求任一已移除的未版本化 API
- **THEN** 系统返回 HTTP 404，客户端必须按迁移文档改用 `/api/v1`
