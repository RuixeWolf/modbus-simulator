import {
  getRTUSerialPath,
  isRTUSerialServerRunning,
  startRTUSerialServer,
  stopRTUSerialServer
} from './rtu-serial-server'
import { getTCPPort, isTCPServerRunning, startTCPServer, stopTCPServer } from './tcp-server'

/** Mutable server configuration shared across TCP and RTU. */
export interface ServerConfig {
  /** TCP listening port (default 502). */
  tcpPort: number
  /** Modbus slave ID / device address (default 1, range 1-247). */
  slaveId: number
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
}

/** Set to true after the first call to prevent duplicate server startups. Uses globalThis to survive Next.js module reloads. */
const g = globalThis as typeof globalThis & { __modbus_initialized__?: boolean }
/** In-memory configuration store. */
const config: ServerConfig = {
  tcpPort: Number(process.env.MODBUS_TCP_PORT) || 502,
  slaveId: Number(process.env.MODBUS_SLAVE_ID) || 1,
  rtuSerialPath: process.env.MODBUS_RTU_SERIAL_PATH || null,
  rtuBaudRate: 9600,
  rtuParity: 'none',
  rtuDataBits: 8,
  rtuStopBits: 1
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
  if (newConfig.tcpPort !== undefined) {
    config.tcpPort = newConfig.tcpPort
  }
  if (newConfig.slaveId !== undefined) {
    config.slaveId = newConfig.slaveId
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
  // Start TCP server
  if (!isTCPServerRunning()) {
    try {
      startTCPServer(config.tcpPort, config.slaveId)
    } catch (e) {
      console.warn('Failed to start Modbus TCP server:', (e as Error).message)
    }
  }

  // Start RTU serial server if path is configured
  if (config.rtuSerialPath && !isRTUSerialServerRunning()) {
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
export function restartServers(): void {
  // Restart TCP server
  if (isTCPServerRunning()) {
    stopTCPServer()
  }
  try {
    startTCPServer(config.tcpPort, config.slaveId)
  } catch (e) {
    console.warn('Failed to restart Modbus TCP server:', (e as Error).message)
  }

  // Restart RTU serial server
  if (isRTUSerialServerRunning()) {
    stopRTUSerialServer()
  }
  if (config.rtuSerialPath) {
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
