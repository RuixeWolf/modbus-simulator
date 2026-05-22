'use client'

import { useCallback, useEffect, useState } from 'react'

/** Snapshot of all Modbus register arrays returned by the REST API. */
export interface ModbusState {
  coils: boolean[]
  discreteInputs: boolean[]
  holdingRegisters: number[]
  inputRegisters: number[]
}

/** Origin of a communication log entry. */
export interface LogSource {
  type: 'tcp' | 'serial' | 'web'
  detail: string
}

/** Metadata for an active TCP client connection. */
export interface TcpClientInfo {
  id: number
  host: string
  port: number
  connectedAt: string
}

/** Single log entry returned by the REST API. */
export interface ModbusLogEntry {
  timestamp: string
  type: 'read' | 'write' | 'error' | 'connection'
  registerType: string
  address: number
  value?: number | boolean
  message?: string
  source?: LogSource
}

/** TCP and RTU server online status. */
export interface ServerStatus {
  tcp: boolean
  rtu: boolean
}

/** Active server configuration returned by the REST API. */
export interface ServerConfig {
  tcpEnabled: boolean
  tcpPort: number
  slaveId: number
  rtuEnabled: boolean
  rtuSerialPath: string | null
  rtuBaudRate: number
  rtuParity: 'none' | 'even' | 'odd'
  rtuDataBits: number
  rtuStopBits: number
  logMaxCount: number
}

/** Metadata for an available serial port. */
export interface SerialPortInfo {
  path: string
  manufacturer: string | null
  serialNumber: string | null
}

/** Log type filter configuration. */
export interface LogFilterConfig {
  read: boolean
  write: boolean
  error: boolean
  connection: boolean
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
    tcpEnabled: true,
    tcpPort: 502,
    slaveId: 1,
    rtuEnabled: true,
    rtuSerialPath: null,
    rtuBaudRate: 9600,
    rtuParity: 'none',
    rtuDataBits: 8,
    rtuStopBits: 1,
    logMaxCount: 1000
  })
  const [serialPorts, setSerialPorts] = useState<SerialPortInfo[]>([])
  const [logFilter, setLogFilter] = useState<LogFilterConfig>({
    read: true,
    write: true,
    error: true,
    connection: true
  })
  const [tcpClients, setTcpClients] = useState<TcpClientInfo[]>([])
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

  const fetchLogFilter = useCallback(async () => {
    try {
      const res = await fetch('/api/config')
      if (!res.ok) throw new Error('Failed to fetch config')
      const data = await res.json()
      if (data.logFilter) {
        setLogFilter(data.logFilter)
      }
    } catch {
      // silently fail for log filter
    }
  }, [])

  const fetchTcpClients = useCallback(async () => {
    try {
      const res = await fetch('/api/tcp-clients')
      if (!res.ok) throw new Error('Failed to fetch TCP clients')
      const data = await res.json()
      if (Array.isArray(data.clients)) {
        setTcpClients(data.clients)
      }
    } catch {
      // silently fail for TCP clients
    }
  }, [])

  /**
   * Disconnects a single TCP client by ID.
   * @param id – Client ID from the TCP client list.
   */
  const disconnectTcpClient = useCallback(
    async (id: number) => {
      try {
        const res = await fetch(`/api/tcp-clients/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed to disconnect client')
        await fetchTcpClients()
        await fetchLogs()
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [fetchTcpClients, fetchLogs]
  )

  /**
   * Disconnects all active TCP clients.
   */
  const disconnectAllTcpClients = useCallback(async () => {
    try {
      const res = await fetch('/api/tcp-clients', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to disconnect all clients')
      await fetchTcpClients()
      await fetchLogs()
    } catch (e) {
      setError((e as Error).message)
    }
  }, [fetchTcpClients, fetchLogs])

  /**
   * Batch-writes registers via POST /api/registers/batch using typed data,
   * then refreshes state and logs.
   */
  const batchWrite = useCallback(
    async (payload: {
      registerType: string
      startAddress: number
      mode: 'number' | 'bytes'
      dataType?: string
      value?: number
      hexString?: string
    }) => {
      try {
        const res = await fetch('/api/registers/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) {
          const errData = await res.json()
          const errMsg =
            typeof errData === 'object' &&
            errData !== null &&
            'error' in errData &&
            typeof errData.error === 'string'
              ? errData.error
              : 'Batch write failed'
          throw new Error(errMsg)
        }
        await fetchState()
        await fetchLogs()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [fetchState, fetchLogs]
  )

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

  /**
   * Updates the log filter via POST /api/config.
   * @param newFilter – Partial or complete log filter config.
   */
  const updateLogFilter = useCallback(async (newFilter: Partial<LogFilterConfig>) => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logFilter: newFilter })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Log filter update failed')
      }
      const data = await res.json()
      if (data.logFilter) {
        setLogFilter(data.logFilter)
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  /**
   * Clears all communication logs via DELETE /api/logs.
   */
  const clearLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/logs', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to clear logs')
      setLogs([])
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await fetchState()
      await fetchLogs()
      await fetchStatus()
      await fetchConfig()
      await fetchSerialPorts()
      await fetchLogFilter()
      await fetchTcpClients()
    }
    void init()

    const interval = setInterval(() => {
      void fetchState()
      void fetchLogs()
      void fetchStatus()
      void fetchTcpClients()
    }, POLL_INTERVAL)

    return () => {
      clearInterval(interval)
    }
  }, [
    fetchState,
    fetchLogs,
    fetchStatus,
    fetchConfig,
    fetchSerialPorts,
    fetchLogFilter,
    fetchTcpClients
  ])

  return {
    state,
    logs,
    status,
    config,
    serialPorts,
    logFilter,
    tcpClients,
    error,
    writeRegister,
    batchWrite,
    updateConfig,
    updateLogFilter,
    clearLogs,
    disconnectTcpClient,
    disconnectAllTcpClients,
    refresh: fetchState
  }
}
