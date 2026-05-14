'use client'

import { useCallback, useEffect, useState } from 'react'

/** Snapshot of all Modbus register arrays returned by the REST API. */
export interface ModbusState {
  coils: boolean[]
  discreteInputs: boolean[]
  holdingRegisters: number[]
  inputRegisters: number[]
}

/** Single log entry returned by the REST API. */
export interface ModbusLogEntry {
  timestamp: string
  type: 'read' | 'write' | 'error'
  registerType: string
  address: number
  value?: number | boolean
  message?: string
}

/** TCP and RTU server online status. */
export interface ServerStatus {
  tcp: boolean
  rtu: boolean
}

/** Active server configuration returned by the REST API. */
export interface ServerConfig {
  tcpPort: number
  slaveId: number
  rtuSerialPath: string | null
  rtuBaudRate: number
  rtuParity: 'none' | 'even' | 'odd'
  rtuDataBits: number
  rtuStopBits: number
}

/** Metadata for an available serial port. */
export interface SerialPortInfo {
  path: string
  manufacturer: string | null
  serialNumber: string | null
}

/** Polling interval in milliseconds for register / status / log updates. */
const POLL_INTERVAL = 1000

/**
 * Hook that polls the backend REST APIs and exposes helpers
 * to read state, write registers, and update server config.
 *
 * @returns Current state, logs, status, config helpers, and error state.
 */
export function useModbusData() {
  const [state, setState] = useState<ModbusState>({
    coils: [],
    discreteInputs: [],
    holdingRegisters: [],
    inputRegisters: []
  })
  const [logs, setLogs] = useState<ModbusLogEntry[]>([])
  const [status, setStatus] = useState<ServerStatus>({ tcp: false, rtu: false })
  const [config, setConfig] = useState<ServerConfig>({
    tcpPort: 502,
    slaveId: 1,
    rtuSerialPath: null,
    rtuBaudRate: 9600,
    rtuParity: 'none',
    rtuDataBits: 8,
    rtuStopBits: 1
  })
  const [serialPorts, setSerialPorts] = useState<SerialPortInfo[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/registers')
      if (!res.ok) throw new Error('Failed to fetch registers')
      const data = await res.json()
      setState(data)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/logs')
      if (!res.ok) throw new Error('Failed to fetch logs')
      const data = await res.json()
      setLogs(data)
    } catch {
      // silently fail for logs
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status')
      if (!res.ok) throw new Error('Failed to fetch status')
      const data = await res.json()
      setStatus(data)
    } catch {
      // silently fail for status
    }
  }, [])

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config')
      if (!res.ok) throw new Error('Failed to fetch config')
      const data = await res.json()
      setConfig(data)
    } catch {
      // silently fail for config
    }
  }, [])

  const fetchSerialPorts = useCallback(async () => {
    try {
      const res = await fetch('/api/serial-ports')
      if (!res.ok) throw new Error('Failed to fetch serial ports')
      const data = await res.json()
      if (Array.isArray(data)) {
        setSerialPorts(data)
      }
    } catch {
      // silently fail for serial ports
    }
  }, [])

  /**
   * Writes a single coil or holding register via POST /api/registers,
   * then refreshes state and logs.
   *
   * @param registerType – "coil" or "holdingRegister".
   * @param address      – Zero-based Modbus address.
   * @param value        – Boolean for coils, 16-bit number for registers.
   */
  const writeRegister = useCallback(
    async (registerType: string, address: number, value: number | boolean) => {
      try {
        const res = await fetch('/api/registers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registerType, address, value })
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Write failed')
        }
        await fetchState()
        await fetchLogs()
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [fetchState, fetchLogs]
  )

  /**
   * Applies new server configuration via POST /api/config,
   * then refreshes config and status.
   * @param newConfig – Complete config object to send.
   */
  const updateConfig = useCallback(
    async (newConfig: ServerConfig) => {
      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newConfig)
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Config update failed')
        }
        await fetchConfig()
        await fetchStatus()
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [fetchConfig, fetchStatus]
  )

  useEffect(() => {
    const init = async () => {
      await fetchState()
      await fetchLogs()
      await fetchStatus()
      await fetchConfig()
      await fetchSerialPorts()
    }
    void init()

    const interval = setInterval(() => {
      void fetchState()
      void fetchLogs()
      void fetchStatus()
    }, POLL_INTERVAL)

    return () => {
      clearInterval(interval)
    }
  }, [fetchState, fetchLogs, fetchStatus, fetchConfig, fetchSerialPorts])

  return {
    state,
    logs,
    status,
    config,
    serialPorts,
    error,
    writeRegister,
    updateConfig,
    refresh: fetchState
  }
}
