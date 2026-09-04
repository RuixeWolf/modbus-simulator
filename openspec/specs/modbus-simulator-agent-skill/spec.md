# Modbus Simulator Agent Skill Specification

## Purpose

向 AI Agent 提供可安装、可直接执行且跨平台的模拟器操作说明与辅助工具，使 Agent 能安全地编排本地 Modbus 集成测试并留下可诊断结果。

## Requirements

### Requirement: Repository-distributed Agent Skill

项目 SHALL 在根目录提供 `skills/modbus-simulator/SKILL.md`，其元数据和目录结构 SHALL 能被 Skills CLI 从 GitHub 仓库发现，并可通过 `npx skills add RuixeWolf/modbus-simulator --skill modbus-simulator` 安装。Skill SHALL 仅随 GitHub 仓库分发，不包含在 `@ruixe/modbus-simulator` npm 发布包中。

#### Scenario: User lists and installs the Skill

- **WHEN** 用户使用 Skills CLI 检查或安装仓库中的 `modbus-simulator` Skill
- **THEN** CLI 能发现正确名称和描述并把完整 Skill 安装到目标 Agent 环境

#### Scenario: npm package is assembled

- **WHEN** 项目执行 npm 发布包预检
- **THEN** 发布包包含模拟器运行时但不包含根目录 `skills/`

### Requirement: Latest package startup workflow

Skill SHALL 将 `npx --yes @ruixe/modbus-simulator@latest` 作为默认运行时启动命令，并 SHALL 在 Agent 工作流中使用独立的高位 HTTP 和 Modbus TCP 端口、JSON readiness 输出、有限超时和 strict-ready 模式。Skill SHALL 说明 `@latest` 会解析到执行时 npm registry 上的最新发布版本。

#### Scenario: Agent follows the default launch recipe

- **WHEN** Agent 按 Skill 的默认流程启动模拟器
- **THEN** Agent 执行以 `npx --yes @ruixe/modbus-simulator@latest` 开头的命令，并等待机器可读 READY 记录后再运行上位机测试

#### Scenario: Readiness fails

- **WHEN** 默认启动流程收到 ERROR 记录或超过 readiness timeout
- **THEN** Agent 停止测试流程并输出可操作的诊断信息，而不假定模拟器已经可用

### Requirement: Dependency-free control helper

Skill SHALL 提供基于 Node.js 20 内置能力、无需安装第三方依赖的 `scripts/control.mjs`，支持 `wait`、`health`、`reset`、`read`、`write`、`write-encoded`、`config` 和 `logs` 命令。辅助脚本 SHALL 从环境变量读取可选 API Token并发送 Bearer Header，SHALL 不负责创建或终止模拟器进程。

#### Scenario: Agent writes and verifies a fixture

- **WHEN** Agent 依次使用 helper 写入寄存器范围并读取同一范围
- **THEN** helper 调用 v1 API、输出适合 Agent 消费的 JSON，并通过返回值验证写入结果

#### Scenario: Helper receives an API failure

- **WHEN** API 返回标准错误信封
- **THEN** helper 将错误码和安全消息输出到 stderr 并以状态码 4 退出

#### Scenario: Helper cannot reach the simulator

- **WHEN** 网络连接失败
- **THEN** helper 输出网络诊断并以状态码 3 退出

#### Scenario: Helper usage is invalid

- **WHEN** 调用方遗漏必需参数或使用未知命令
- **THEN** helper 输出用法并以状态码 2 退出

#### Scenario: Helper wait times out

- **WHEN** `wait` 命令在规定时间内无法观察到 ready health
- **THEN** helper 以状态码 5 退出并提供最后一次安全诊断

### Requirement: Complete automation lifecycle guidance

Skill SHALL 指导 Agent 按“启动自己拥有的进程、等待就绪、应用配置、清空测试状态和日志、运行被测上位机、在测试中修改或读取指定寄存器、收集日志、只终止自己启动的进程”的顺序工作。Skill SHALL 明确避免杀死无法确认归属的现有模拟器进程。

#### Scenario: Agent runs an isolated integration test

- **WHEN** Agent 从 Skill 开始一次新的上位机集成测试
- **THEN** Agent 使用独立端口和干净状态完成测试，并在结束时仅清理本次启动的进程

#### Scenario: Selected port is already occupied

- **WHEN** Skill 默认示例端口已被其他进程占用
- **THEN** Agent 选择另一组高位端口重新启动，而不终止未知占用进程

### Requirement: Addressing and data representation guidance

Skill SHALL 说明控制 API 使用 0 起始地址，并给出与常见 `00001`、`10001`、`30001`、`40001` 人类表示法的映射；SHALL 说明 discrete inputs 和 input registers 在 Modbus 协议中只读但可由控制 API 设置测试夹具；并 SHALL 记录布尔值、16 位寄存器、编码数值和十六进制字节的合法表示。

#### Scenario: Agent converts a human register reference

- **WHEN** 测试需求引用常见的 `40001` holding register
- **THEN** Agent 根据 Skill 将其转换为控制 API 的 holding-registers 地址 0

#### Scenario: Agent simulates sensor input

- **WHEN** 上位机测试需要改变协议只读的 input register
- **THEN** Agent 使用控制 API 设置该测试夹具，而不是尝试通过 Modbus 写功能码修改它

### Requirement: Cross-platform and deployment guidance

Skill SHALL 提供 Windows 与 Linux/macOS 串口示例、回环默认值、局域网或容器监听时的 Token 要求，以及失败时检查 health、日志、端口占用和串口权限的排障步骤。

#### Scenario: Agent configures a serial simulator on Windows

- **WHEN** Agent 在 Windows 环境执行 RTU 测试
- **THEN** Skill 指导其选择实际枚举到的 COM 端口并通过 health 验证 RTU 已运行

#### Scenario: Agent exposes the simulator to a container

- **WHEN** 被测程序无法通过宿主回环地址访问模拟器
- **THEN** Skill 指导 Agent 显式配置监听地址和 Token，并避免建立未认证的公开控制面
