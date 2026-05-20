import {
  getRTUSerialPath,
  isRTUSerialServerRunning,
  startRTUSerialServer,
  stopRTUSerialServer
} from './rtu-serial-server'
import { getTCPPort, isTCPServerRunning, startTCPServer, stopTCPServer } from './tcp-server'

/** Mutable server configuration shared across TCP and RTU. */
export interface ServerConfig {
  /** Whether the TCP server is enabled. */
  tcpEnabled: boolean
  /** TCP listening port (default 502). */
  tcpPort: number
  /** Modbus slave ID / device address (default 1, range 1-247). */
  slaveId: number
  /** Whether the RTU serial server is enabled. */
  rtuEnabled: boolean
  /** OS serial port path for RTU; null disables the RTU server. */
  rtuSerialPath: string | null
  /** Serial baud rate for RTU (default 9600). */
  rtuBaudRate: number
  /** Serial parity for RTU: none | even | odd (default none). */
  rtuParity: 'none' | 'even' | 'odd'
  /** Serial data bits for RTU: 5-8 (default 8). */
  rtuDataBits: number
  /** Serial stop bits for RTU: 1 | 2 (default 1). */
  rtuStopBits: number
  /** Maximum in-memory communication log entries (default 1000, range 100-10000). */
  logMaxCount: number
}

/** Set to true after the first call to prevent duplicate server startups. Uses globalThis to survive Next.js module reloads. */
const g = globalThis as typeof globalThis & { __modbus_initialized__?: boolean }

/**
 * Parses and validates a Modbus slave ID from environment variable.
 * @param envValue - Raw environment variable value
 * @returns Valid slave ID (1-247) or default (1)
 */
function parseSlaveId(envValue: string | undefined): number {
  if (!envValue) return 1
  const parsed = Number(envValue)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 247) {
    console.warn(`Invalid MODBUS_SLAVE_ID="${envValue}" (must be integer 1-247), using default: 1`)
    return 1
  }
  return parsed
}

/**
 * Parses a boolean from an environment variable.
 * @param envValue - Raw environment variable value
 * @param defaultValue - Fallback when envValue is undefined/empty
 * @returns Parsed boolean
 */
function parseBool(envValue: string | undefined, defaultValue: boolean): boolean {
  if (!envValue) return defaultValue
  const lower = envValue.trim().toLowerCase()
  if (lower === 'true' || lower === '1' || lower === 'yes') return true
  if (lower === 'false' || lower === '0' || lower === 'no') return false
  return defaultValue
}

/** In-memory configuration store. */
const config: ServerConfig = {
  tcpEnabled: parseBool(process.env.MODBUS_TCP_ENABLED, true),
  tcpPort: Number(process.env.MODBUS_TCP_PORT) || 502,
  slaveId: parseSlaveId(process.env.MODBUS_SLAVE_ID),
  rtuEnabled: parseBool(process.env.MODBUS_RTU_ENABLED, true),
  rtuSerialPath: process.env.MODBUS_RTU_SERIAL_PATH || null,
  rtuBaudRate: 9600,
  rtuParity: 'none',
  rtuDataBits: 8,
  rtuStopBits: 1,
  logMaxCount: Number(process.env.MODBUS_LOG_MAX_COUNT) || 1000
}

/**
 * @returns A shallow copy of the current server configuration.
 */
export function getConfig(): ServerConfig {
  return { ...config }
}

/**
 * Updates one or more config fields without restarting servers.
 * @param newConfig – Partial config object with fields to overwrite.
 */
export function setConfig(newConfig: Partial<ServerConfig>): void {
  if (newConfig.tcpEnabled !== undefined) {
    config.tcpEnabled = newConfig.tcpEnabled
  }
  if (newConfig.tcpPort !== undefined) {
    config.tcpPort = newConfig.tcpPort
  }
  if (newConfig.slaveId !== undefined) {
    config.slaveId = newConfig.slaveId
  }
  if (newConfig.rtuEnabled !== undefined) {
    config.rtuEnabled = newConfig.rtuEnabled
  }
  if (newConfig.rtuSerialPath !== undefined) {
    config.rtuSerialPath = newConfig.rtuSerialPath
  }
  if (newConfig.rtuBaudRate !== undefined) {
    config.rtuBaudRate = newConfig.rtuBaudRate
  }
  if (newConfig.rtuParity !== undefined) {
    config.rtuParity = newConfig.rtuParity
  }
  if (newConfig.rtuDataBits !== undefined) {
    config.rtuDataBits = newConfig.rtuDataBits
  }
  if (newConfig.rtuStopBits !== undefined) {
    config.rtuStopBits = newConfig.rtuStopBits
  }
  if (newConfig.logMaxCount !== undefined) {
    config.logMaxCount = newConfig.logMaxCount
  }
}

/**
 * Idempotent guard used by API route imports.
 * Starts TCP and optional RTU serial servers on first call.
 */
export function ensureServersStarted(): void {
  if (g.__modbus_initialized__) return
  g.__modbus_initialized__ = true

  startServers()
}

/** Starts TCP and RTU serial servers using the current {@link config}. */
export function startServers(): void {
  // Start TCP server if enabled
  if (config.tcpEnabled && !isTCPServerRunning()) {
    try {
      startTCPServer(config.tcpPort, config.slaveId)
    } catch (e) {
      console.warn('Failed to start Modbus TCP server:', (e as Error).message)
    }
  }

  // Start RTU serial server if enabled and path is configured
  if (config.rtuEnabled && config.rtuSerialPath && !isRTUSerialServerRunning()) {
    try {
      startRTUSerialServer(config.rtuSerialPath, {
        baudRate: config.rtuBaudRate,
        parity: config.rtuParity,
        dataBits: config.rtuDataBits,
        stopBits: config.rtuStopBits,
        slaveId: config.slaveId
      })
    } catch (e) {
      console.warn('Failed to start Modbus RTU serial server:', (e as Error).message)
    }
  }
}

/** Stops then restarts both servers with the current {@link config}. */
export async function restartServers(): Promise<void> {
  // TCP server: stop if running but disabled, or if running and we need to restart
  if (isTCPServerRunning() && !config.tcpEnabled) {
    await stopTCPServer()
  } else if (config.tcpEnabled) {
    if (isTCPServerRunning()) {
      await stopTCPServer()
    }
    try {
      startTCPServer(config.tcpPort, config.slaveId)
    } catch (e) {
      console.warn('Failed to restart Modbus TCP server:', (e as Error).message)
    }
  }

  // RTU serial server: stop if running but disabled, or restart if enabled
  if (isRTUSerialServerRunning() && (!config.rtuEnabled || !config.rtuSerialPath)) {
    await stopRTUSerialServer()
  } else if (config.rtuEnabled && config.rtuSerialPath) {
    if (isRTUSerialServerRunning()) {
      await stopRTUSerialServer()
      // Give the OS time to fully release the serial port handle before reopening
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    try {
      startRTUSerialServer(config.rtuSerialPath, {
        baudRate: config.rtuBaudRate,
        parity: config.rtuParity,
        dataBits: config.rtuDataBits,
        stopBits: config.rtuStopBits,
        slaveId: config.slaveId
      })
    } catch (e) {
      console.warn('Failed to restart Modbus RTU serial server:', (e as Error).message)
    }
  }
}

export { isTCPServerRunning, isRTUSerialServerRunning, getTCPPort, getRTUSerialPath }
