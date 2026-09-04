import { randomUUID } from 'node:crypto'
import { TRANSPORT_STATE } from './control/constants'
import { CONTROL_ERROR_CODE, ControlError } from './control/errors'
import type { ServerConfig, ServerConfigPatch } from './control/schemas'
import { ModbusEngine } from './engine'
import type { LogFilterConfig } from './engine'
import {
  getRTUError,
  isRTUSerialServerRunning,
  startRTUSerialServer,
  stopRTUSerialServer,
  waitForRTUSerialServerReady
} from './rtu-serial-server'
import {
  disconnectAllTCPClients,
  getTCPClients,
  getTCPError,
  isTCPServerRunning,
  startTCPServer,
  stopTCPServer,
  waitForTCPServerReady
} from './tcp-server'

interface TcpActualConfig {
  host: string
  port: number
  slaveId: number
}

interface RtuActualConfig {
  serialPath: string
  baudRate: number
  parity: 'none' | 'even' | 'odd'
  dataBits: number
  stopBits: number
  slaveId: number
}

interface TransportLifecycle<TActual> {
  state: (typeof TRANSPORT_STATE)[keyof typeof TRANSPORT_STATE]
  lastTransitionAt: string
  error: string | null
  actualConfig: TActual | null
}

export interface RuntimeLifecycle {
  tcp: TransportLifecycle<TcpActualConfig>
  rtu: TransportLifecycle<RtuActualConfig>
}

export interface ConfigApplyEffects {
  tcpRestarted: boolean
  rtuRestarted: boolean
  tcpClientsDisconnected: number
}

export interface RuntimeHealth {
  packageVersion: string
  apiVersion: string
  instanceId: string
  startedAt: string
  ready: boolean
  desiredConfig: ServerConfig
  transports: RuntimeLifecycle
}

const DEFAULT_LOG_FILTER: LogFilterConfig = {
  read: true,
  write: true,
  error: true,
  connection: true,
  system: true
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback
  if (['1', 'true', 'yes'].includes(value.trim().toLowerCase())) return true
  if (['0', 'false', 'no'].includes(value.trim().toLowerCase())) return false
  return fallback
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

function initialConfig(): ServerConfig {
  return {
    tcpEnabled: parseBoolean(process.env.MODBUS_TCP_ENABLED, true),
    tcpHost: process.env.MODBUS_TCP_HOST || '127.0.0.1',
    tcpPort: parseInteger(process.env.MODBUS_TCP_PORT, 502, 1, 65535),
    slaveId: parseInteger(process.env.MODBUS_SLAVE_ID, 1, 1, 247),
    rtuEnabled: parseBoolean(process.env.MODBUS_RTU_ENABLED, true),
    rtuSerialPath: process.env.MODBUS_RTU_SERIAL_PATH || null,
    rtuBaudRate: parseInteger(process.env.MODBUS_RTU_BAUD_RATE, 9600, 300, 115200),
    rtuParity: 'none',
    rtuDataBits: 8,
    rtuStopBits: 1,
    logMaxCount: parseInteger(process.env.MODBUS_LOG_MAX_COUNT, 1000, 100, 10000),
    logFilter: { ...DEFAULT_LOG_FILTER }
  }
}

function initialTransport<TActual>(): TransportLifecycle<TActual> {
  return {
    state: TRANSPORT_STATE.STOPPED,
    lastTransitionAt: new Date().toISOString(),
    error: null,
    actualConfig: null
  }
}

const runtimeGlobal = globalThis as typeof globalThis & {
  __modbus_runtime_coordinator__?: RuntimeCoordinator | null
}

export class RuntimeCoordinator {
  private static instance: RuntimeCoordinator | null =
    runtimeGlobal.__modbus_runtime_coordinator__ ?? null

  readonly instanceId = randomUUID()
  readonly startedAt = new Date().toISOString()
  private desiredConfig = initialConfig()
  private lifecycle: RuntimeLifecycle = {
    tcp: initialTransport<TcpActualConfig>(),
    rtu: initialTransport<RtuActualConfig>()
  }
  private transitionQueue: Promise<unknown> = Promise.resolve()
  private startupPromise: Promise<void> | null = null

  static getInstance(): RuntimeCoordinator {
    if (!RuntimeCoordinator.instance) {
      RuntimeCoordinator.instance = new RuntimeCoordinator()
      runtimeGlobal.__modbus_runtime_coordinator__ = RuntimeCoordinator.instance
    }
    return RuntimeCoordinator.instance
  }

  static resetInstanceForTests(): void {
    RuntimeCoordinator.instance = null
    runtimeGlobal.__modbus_runtime_coordinator__ = null
  }

  getConfig(): ServerConfig {
    return { ...this.desiredConfig, logFilter: { ...this.desiredConfig.logFilter } }
  }

  getLifecycle(): RuntimeLifecycle {
    return {
      tcp: {
        ...this.lifecycle.tcp,
        actualConfig: this.lifecycle.tcp.actualConfig && { ...this.lifecycle.tcp.actualConfig }
      },
      rtu: {
        ...this.lifecycle.rtu,
        actualConfig: this.lifecycle.rtu.actualConfig && { ...this.lifecycle.rtu.actualConfig }
      }
    }
  }

  getHealth(packageVersion: string, apiVersion: string): RuntimeHealth {
    const tcpReady =
      !this.desiredConfig.tcpEnabled || this.lifecycle.tcp.state === TRANSPORT_STATE.RUNNING
    const rtuRequired = this.desiredConfig.rtuEnabled && this.desiredConfig.rtuSerialPath !== null
    const rtuReady = !rtuRequired || this.lifecycle.rtu.state === TRANSPORT_STATE.RUNNING
    return {
      packageVersion,
      apiVersion,
      instanceId: this.instanceId,
      startedAt: this.startedAt,
      ready: tcpReady && rtuReady,
      desiredConfig: this.getConfig(),
      transports: this.getLifecycle()
    }
  }

  ensureStarted(): Promise<void> {
    this.startupPromise ??= this.enqueue(async () => {
      const engine = ModbusEngine.getInstance()
      engine.setLogMaxCount(this.desiredConfig.logMaxCount)
      engine.setLogFilter(this.desiredConfig.logFilter)
      await Promise.allSettled([this.startTcp(), this.startRtu()])
    })
    return this.startupPromise
  }

  applyConfig(patch: ServerConfigPatch): Promise<ConfigApplyEffects> {
    return this.enqueue(async () => {
      const previous = this.getConfig()
      this.desiredConfig = {
        ...previous,
        ...patch,
        logFilter: patch.logFilter ? { ...patch.logFilter } : previous.logFilter
      }

      const engine = ModbusEngine.getInstance()
      engine.setLogMaxCount(this.desiredConfig.logMaxCount)
      engine.setLogFilter(this.desiredConfig.logFilter)

      const tcpFields: (keyof ServerConfig)[] = ['tcpEnabled', 'tcpHost', 'tcpPort', 'slaveId']
      const rtuFields: (keyof ServerConfig)[] = [
        'rtuEnabled',
        'rtuSerialPath',
        'rtuBaudRate',
        'rtuParity',
        'rtuDataBits',
        'rtuStopBits',
        'slaveId'
      ]
      const tcpChanged = tcpFields.some((field) => previous[field] !== this.desiredConfig[field])
      const rtuChanged = rtuFields.some((field) => previous[field] !== this.desiredConfig[field])
      const effects: ConfigApplyEffects = {
        tcpRestarted: tcpChanged,
        rtuRestarted: rtuChanged,
        tcpClientsDisconnected: 0
      }

      try {
        if (tcpChanged) {
          effects.tcpClientsDisconnected = getTCPClients().length
          await this.stopTcp()
          await this.startTcp()
        }
        if (rtuChanged) {
          await this.stopRtu()
          await this.startRtu()
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        engine.addSystemLog(`Configuration apply failed: ${message}`)
        throw new ControlError(CONTROL_ERROR_CODE.UNAVAILABLE, message)
      }

      engine.addSystemLog('Runtime configuration applied successfully')
      return effects
    })
  }

  restartAll(): Promise<void> {
    return this.enqueue(async () => {
      await this.stopTcp()
      await this.stopRtu()
      await Promise.allSettled([this.startTcp(), this.startRtu()])
    })
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.transitionQueue.then(operation, operation)
    this.transitionQueue = result.catch(() => undefined)
    return result
  }

  private updateTcp(update: Partial<TransportLifecycle<TcpActualConfig>>): void {
    this.lifecycle.tcp = {
      ...this.lifecycle.tcp,
      ...update,
      lastTransitionAt: new Date().toISOString()
    }
  }

  private updateRtu(update: Partial<TransportLifecycle<RtuActualConfig>>): void {
    this.lifecycle.rtu = {
      ...this.lifecycle.rtu,
      ...update,
      lastTransitionAt: new Date().toISOString()
    }
  }

  private async startTcp(): Promise<void> {
    if (!this.desiredConfig.tcpEnabled) {
      this.updateTcp({ state: TRANSPORT_STATE.DISABLED, error: null, actualConfig: null })
      return
    }
    if (isTCPServerRunning()) return
    this.updateTcp({ state: TRANSPORT_STATE.STARTING, error: null, actualConfig: null })
    try {
      startTCPServer(
        this.desiredConfig.tcpPort,
        this.desiredConfig.slaveId,
        this.desiredConfig.tcpHost
      )
      await waitForTCPServerReady()
      this.updateTcp({
        state: TRANSPORT_STATE.RUNNING,
        error: null,
        actualConfig: {
          host: this.desiredConfig.tcpHost,
          port: this.desiredConfig.tcpPort,
          slaveId: this.desiredConfig.slaveId
        }
      })
      ModbusEngine.getInstance().addSystemLog(
        `TCP transport started on ${this.desiredConfig.tcpHost}:${this.desiredConfig.tcpPort}`,
        'tcp'
      )
    } catch (error) {
      const message = getTCPError() || (error instanceof Error ? error.message : String(error))
      this.updateTcp({ state: TRANSPORT_STATE.ERROR, error: message, actualConfig: null })
      ModbusEngine.getInstance().addSystemLog(`TCP transport failed: ${message}`, 'tcp')
      throw error
    }
  }

  private async stopTcp(): Promise<void> {
    if (!isTCPServerRunning() && this.lifecycle.tcp.state === TRANSPORT_STATE.STOPPED) return
    this.updateTcp({ state: TRANSPORT_STATE.STOPPING })
    disconnectAllTCPClients()
    await stopTCPServer()
    this.updateTcp({ state: TRANSPORT_STATE.STOPPED, error: null, actualConfig: null })
    ModbusEngine.getInstance().addSystemLog('TCP transport stopped', 'tcp')
  }

  private async startRtu(): Promise<void> {
    if (!this.desiredConfig.rtuEnabled || !this.desiredConfig.rtuSerialPath) {
      this.updateRtu({ state: TRANSPORT_STATE.DISABLED, error: null, actualConfig: null })
      return
    }
    if (isRTUSerialServerRunning()) return
    this.updateRtu({ state: TRANSPORT_STATE.STARTING, error: null, actualConfig: null })
    try {
      startRTUSerialServer(this.desiredConfig.rtuSerialPath, {
        baudRate: this.desiredConfig.rtuBaudRate,
        parity: this.desiredConfig.rtuParity,
        dataBits: this.desiredConfig.rtuDataBits,
        stopBits: this.desiredConfig.rtuStopBits,
        slaveId: this.desiredConfig.slaveId
      })
      await waitForRTUSerialServerReady()
      this.updateRtu({
        state: TRANSPORT_STATE.RUNNING,
        error: null,
        actualConfig: {
          serialPath: this.desiredConfig.rtuSerialPath,
          baudRate: this.desiredConfig.rtuBaudRate,
          parity: this.desiredConfig.rtuParity,
          dataBits: this.desiredConfig.rtuDataBits,
          stopBits: this.desiredConfig.rtuStopBits,
          slaveId: this.desiredConfig.slaveId
        }
      })
      ModbusEngine.getInstance().addSystemLog(
        `RTU transport started on ${this.desiredConfig.rtuSerialPath}`,
        'rtu'
      )
    } catch (error) {
      const message = getRTUError() || (error instanceof Error ? error.message : String(error))
      this.updateRtu({ state: TRANSPORT_STATE.ERROR, error: message, actualConfig: null })
      ModbusEngine.getInstance().addSystemLog(`RTU transport failed: ${message}`, 'rtu')
      throw error
    }
  }

  private async stopRtu(): Promise<void> {
    if (!isRTUSerialServerRunning() && this.lifecycle.rtu.state === TRANSPORT_STATE.STOPPED) return
    this.updateRtu({ state: TRANSPORT_STATE.STOPPING })
    await stopRTUSerialServer()
    this.updateRtu({ state: TRANSPORT_STATE.STOPPED, error: null, actualConfig: null })
    ModbusEngine.getInstance().addSystemLog('RTU transport stopped', 'rtu')
  }
}

export function getRuntimeCoordinator(): RuntimeCoordinator {
  return RuntimeCoordinator.getInstance()
}
