# Automation Runtime Lifecycle Specification

## Purpose

为人类用户和自动化调用方提供一致、准确且可等待的模拟器生命周期，使启动、运行时重配置、失败诊断和进程退出在本地及 CI 环境中均可预测。

## Requirements

### Requirement: Accurate transport lifecycle state

系统 SHALL 为 TCP 和 RTU 传输分别报告 `disabled`、`starting`、`running`、`stopping`、`stopped` 或 `error` 状态，并报告最近转换时间和可用的错误信息。TCP 传输仅在监听套接字成功绑定后 SHALL 进入 `running`；RTU 传输仅在串口成功打开后 SHALL 进入 `running`。

#### Scenario: TCP listener becomes ready

- **WHEN** TCP 服务成功绑定配置的地址和端口
- **THEN** TCP 状态从 `starting` 转为 `running`，健康信息中的实际端点与已绑定端点一致

#### Scenario: TCP port is already occupied

- **WHEN** TCP 服务无法绑定配置端口
- **THEN** TCP 状态转为 `error` 并保留可诊断错误，且系统不得将该传输报告为运行中

#### Scenario: RTU is intentionally disabled

- **WHEN** RTU 未启用或未配置串口路径
- **THEN** RTU 状态为 `disabled`，且该状态不阻止模拟器整体就绪

### Requirement: Stable instance identity and health readiness

每次模拟器进程启动 SHALL 生成一个新的 `instanceId` 和 `startedAt`，同一进程内 SHALL 保持不变。`GET /api/v1/health` SHALL 返回软件包版本、API 版本、实例信息、整体 `ready`、期望配置以及 TCP/RTU 的实际状态。整体 `ready` SHALL 仅在所有必需且已启用的传输均运行时为 `true`。

#### Scenario: Health is ready

- **WHEN** HTTP 控制面可用且全部启用的传输已成功启动
- **THEN** 健康响应报告 `ready: true`、`packageVersion: "1.1.0"`、`apiVersion: "1"` 和稳定的实例信息

#### Scenario: Enabled transport has failed

- **WHEN** 任一必需且已启用的传输处于 `error`
- **THEN** 健康响应报告 `ready: false`，同时 Dashboard 控制面仍可用于诊断和修复

### Requirement: Serialized idempotent lifecycle operations

初始启动和运行时配置转换 SHALL 幂等且串行执行；并发调用 SHALL 不创建重复服务器、交错停止/启动或暴露不存在的中间成功状态。仅受配置变更影响的传输 SHALL 被重启，纯日志配置变更 SHALL 不重启传输。

#### Scenario: Multiple callers request startup

- **WHEN** 多个路由或启动钩子并发请求启动服务
- **THEN** 系统共享同一次启动结果且每种传输最多创建一个活动服务器

#### Scenario: Two configuration patches overlap

- **WHEN** 两个配置变更并发到达
- **THEN** 系统按确定顺序完成两个转换，最终期望配置和实际状态对应最后一个已提交变更

#### Scenario: Log-only configuration changes

- **WHEN** 配置变更仅修改日志选项
- **THEN** 系统应用日志配置并报告 TCP 与 RTU 均未重启

### Requirement: Desired configuration survives apply failures

`PATCH /api/v1/config` SHALL 在完整校验后保存期望配置，并串行应用必要的传输变更。响应 SHALL 报告 `tcpRestarted`、`rtuRestarted` 和 `tcpClientsDisconnected` 等效果。若应用失败，系统 SHALL 保留已接受的期望配置、在实际状态中记录错误并返回非 2xx；系统 SHALL 不自动回滚到旧配置。

#### Scenario: Configuration applies successfully

- **WHEN** Agent 提交有效配置且受影响传输成功重启
- **THEN** 系统返回成功，期望配置与实际配置一致，并准确报告重启和断连效果

#### Scenario: New port cannot be bound

- **WHEN** Agent 提交有效的新 TCP 端口但运行时无法绑定
- **THEN** 系统返回非 2xx，保留新端口作为期望配置，并将 TCP 实际状态报告为 `error` 而不伪装回滚成功

### Requirement: Safe default listeners

HTTP 控制面和 Modbus TCP 的默认监听地址 SHALL 为 `127.0.0.1`。当任一控制面监听配置为非回环地址时，系统 SHALL 要求配置 API Token，否则 SHALL 在启动前拒绝该配置。局域网或容器部署 SHALL 通过显式监听地址和 Token 启用。

#### Scenario: Simulator starts with defaults

- **WHEN** 用户未指定 HTTP 或 Modbus TCP 监听地址
- **THEN** 两个服务仅监听 `127.0.0.1`

#### Scenario: Non-loopback control plane has no token

- **WHEN** 用户请求 HTTP 控制面监听 `0.0.0.0` 或其他非回环地址但未配置 Token
- **THEN** CLI 以配置错误拒绝启动，且不得创建公开的未认证控制面

#### Scenario: Authenticated LAN mode starts

- **WHEN** 用户显式指定非回环监听地址并通过环境变量或 Token 文件提供 Token
- **THEN** 系统启动并对操作端点强制 Bearer Token 认证

### Requirement: Secure token inputs

CLI SHALL 仅通过 `MODBUS_API_TOKEN` 环境变量或 `--api-token-file` 读取控制 API Token，SHALL 不接受会暴露于进程参数列表的明文 Token 参数。Token 文件读取失败或内容为空 SHALL 被视为配置错误。系统 SHALL 使用避免时序泄漏的比较方式验证 Token。

#### Scenario: Token is loaded from a file

- **WHEN** 用户传入可读取且非空的 `--api-token-file`
- **THEN** 系统使用文件内容保护操作端点且不在输出中回显内容

#### Scenario: Token file is invalid

- **WHEN** Token 文件不存在、不可读或内容为空
- **THEN** CLI 在启动服务前以配置错误退出

### Requirement: Machine-readable CLI readiness

CLI SHALL 支持 `--ready-output text|json`、`--ready-timeout <seconds>` 和 `--strict-ready`。JSON 模式 SHALL 以单行 `MODBUS_SIMULATOR_READY ` 前缀输出包含版本、实例 ID、HTTP 基础 URL、Modbus TCP 端点和传输状态的 JSON；启动失败 SHALL 以单行 `MODBUS_SIMULATOR_ERROR ` 前缀输出不含秘密的 JSON。

#### Scenario: Strict automation startup succeeds

- **WHEN** Agent 以 JSON 输出和 strict-ready 模式启动且必需服务在超时前就绪
- **THEN** CLI 仅在真实就绪后输出一条可解析的 READY 记录并保持模拟器进程运行

#### Scenario: Strict automation startup times out

- **WHEN** 必需服务在 ready timeout 前未就绪
- **THEN** CLI 输出 ERROR 记录、停止其创建的子进程并以非零状态退出

#### Scenario: Human startup is degraded

- **WHEN** 用户未启用 strict-ready 且某个传输启动失败
- **THEN** HTTP Dashboard 可以继续运行以供诊断，CLI 以文本或 JSON 明确报告降级状态

### Requirement: Strict CLI option validation

CLI SHALL 支持 HTTP 主机、Modbus TCP 主机、HTTP 端口、TCP 端口、串口、从站 ID、Token 文件和 readiness 选项，并 SHALL 在创建服务前严格验证未知选项、端口范围、从站 ID、主机、超时和枚举值。未知或非法选项 SHALL 以退出码 2 终止。

#### Scenario: Unknown option is supplied

- **WHEN** 调用方传入未定义的 CLI 选项
- **THEN** CLI 输出用法错误并以状态码 2 退出且不启动服务

#### Scenario: Invalid numeric option is supplied

- **WHEN** 调用方传入范围外端口、从站 ID 或 readiness timeout
- **THEN** CLI 输出可定位到该选项的错误并以状态码 2 退出

### Requirement: Dashboard session authentication

当操作端点返回 401 时，Dashboard SHALL 提示用户输入 Token，使用健康端点验证后仅保存到当前浏览器标签页的 `sessionStorage`，并在后续 API 请求中发送 Bearer Header。Dashboard SHALL 不把 Token 放入 URL、持久化到 `localStorage` 或显示在普通日志中。

#### Scenario: Dashboard connects to protected simulator

- **WHEN** 用户在 Token 提示中输入有效 Token
- **THEN** Dashboard 验证成功、在当前会话中保存 Token并恢复数据轮询

#### Scenario: Dashboard receives an invalid token

- **WHEN** 用户输入错误 Token
- **THEN** Dashboard 保持未认证状态、显示可重试错误且不持久化错误 Token

### Requirement: Lifecycle events are observable

系统 SHALL 为启动、停止、重配置成功和失败生成 `system` 类型日志；由控制 API 触发的写操作 SHALL 标记为 `api` 来源。系统日志 SHALL 不包含认证秘密。

#### Scenario: Runtime reconfiguration fails

- **WHEN** 配置应用导致传输进入错误状态
- **THEN** 日志中出现包含安全诊断信息的 system 事件，且相关 API 操作可通过 api 来源识别
