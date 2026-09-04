'use client'

import { useCallback, useEffect, useState } from 'react'
import { ControlApiError, controlRequest, validateAndStoreControlToken } from '@/src/lib/api/client'

export interface ModbusState {
  coils: boolean[]
  discreteInputs: boolean[]
  holdingRegisters: number[]
  inputRegisters: number[]
}

export const LOG_SOURCE_TYPE = {
  TCP: 'tcp',
  SERIAL: 'serial',
  WEB: 'web',
  API: 'api'
} as const

export interface LogSource {
  type: (typeof LOG_SOURCE_TYPE)[keyof typeof LOG_SOURCE_TYPE]
  detail: string
}

export const LOG_ENTRY_TYPE = {
  READ: 'read',
  WRITE: 'write',
  ERROR: 'error',
  CONNECTION: 'connection',
  SYSTEM: 'system'
} as const

export interface ModbusLogEntry {
  id: number
  timestamp: string
  type: (typeof LOG_ENTRY_TYPE)[keyof typeof LOG_ENTRY_TYPE]
  registerType: string
  address: number
  value?: number | boolean
  message?: string
  source?: LogSource
}

export interface TcpClientInfo {
  id: number
  host: string
  port: number
  connectedAt: string
}

export const TRANSPORT_STATE = {
  DISABLED: 'disabled',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  ERROR: 'error'
} as const

export type TransportState = (typeof TRANSPORT_STATE)[keyof typeof TRANSPORT_STATE]

interface TransportLifecycle {
  state: TransportState
  lastTransitionAt: string
  error: string | null
  actualConfig: Record<string, unknown> | null
}

export interface ServerStatus {
  tcp: boolean
  rtu: boolean
  ready: boolean
  tcpState: TransportState
  rtuState: TransportState
  tcpError: string | null
  rtuError: string | null
}

export interface LogFilterConfig {
  read: boolean
  write: boolean
  error: boolean
  connection: boolean
  system: boolean
}

export interface ServerConfig {
  tcpEnabled: boolean
  tcpHost: string
  tcpPort: number
  slaveId: number
  rtuEnabled: boolean
  rtuSerialPath: string | null
  rtuBaudRate: number
  rtuParity: 'none' | 'even' | 'odd'
  rtuDataBits: 5 | 6 | 7 | 8
  rtuStopBits: 1 | 2
  logMaxCount: number
  logFilter: LogFilterConfig
}

export interface SerialPortInfo {
  path: string
  manufacturer: string | null
  serialNumber: string | null
}

interface HealthResponse {
  ready: boolean
  desiredConfig: ServerConfig
  transports: { tcp: TransportLifecycle; rtu: TransportLifecycle }
}

interface ConfigResponse {
  desired: ServerConfig
  actual: { tcp: TransportLifecycle; rtu: TransportLifecycle }
}

const POLL_INTERVAL = 1000
const EMPTY_STATE: ModbusState = {
  coils: [],
  discreteInputs: [],
  holdingRegisters: [],
  inputRegisters: []
}
const DEFAULT_LOG_FILTER: LogFilterConfig = {
  read: true,
  write: true,
  error: true,
  connection: true,
  system: true
}
const DEFAULT_CONFIG: ServerConfig = {
  tcpEnabled: true,
  tcpHost: '127.0.0.1',
  tcpPort: 502,
  slaveId: 1,
  rtuEnabled: true,
  rtuSerialPath: null,
  rtuBaudRate: 9600,
  rtuParity: 'none',
  rtuDataBits: 8,
  rtuStopBits: 1,
  logMaxCount: 1000,
  logFilter: DEFAULT_LOG_FILTER
}
const DEFAULT_STATUS: ServerStatus = {
  tcp: false,
  rtu: false,
  ready: false,
  tcpState: TRANSPORT_STATE.STOPPED,
  rtuState: TRANSPORT_STATE.DISABLED,
  tcpError: null,
  rtuError: null
}

function tableForRegisterType(registerType: string): string {
  const tables: Record<string, string> = {
    coil: 'coils',
    discreteInput: 'discrete-inputs',
    holdingRegister: 'holding-registers',
    inputRegister: 'input-registers'
  }
  return tables[registerType] ?? registerType
}

export function useModbusData() {
  const [state, setState] = useState<ModbusState>(EMPTY_STATE)
  const [logs, setLogs] = useState<ModbusLogEntry[]>([])
  const [status, setStatus] = useState<ServerStatus>(DEFAULT_STATUS)
  const [config, setConfig] = useState<ServerConfig>(DEFAULT_CONFIG)
  const [serialPorts, setSerialPorts] = useState<SerialPortInfo[]>([])
  const [tcpClients, setTcpClients] = useState<TcpClientInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [requiresToken, setRequiresToken] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const captureError = useCallback((cause: unknown, silent = false) => {
    if (cause instanceof ControlApiError && cause.status === 401) setRequiresToken(true)
    if (!silent) setError(cause instanceof Error ? cause.message : String(cause))
  }, [])

  const fetchState = useCallback(async () => {
    try {
      setState(await controlRequest<ModbusState>('/api/v1/state'))
      setError(null)
    } catch (cause) {
      captureError(cause)
    }
  }, [captureError])

  const fetchLogs = useCallback(async () => {
    try {
      const data = await controlRequest<{ entries: ModbusLogEntry[] }>('/api/v1/logs?limit=1000')
      setLogs(data.entries)
    } catch (cause) {
      captureError(cause, true)
    }
  }, [captureError])

  const fetchHealth = useCallback(async () => {
    try {
      const health = await controlRequest<HealthResponse>('/api/v1/health')
      setStatus({
        tcp: health.transports.tcp.state === TRANSPORT_STATE.RUNNING,
        rtu: health.transports.rtu.state === TRANSPORT_STATE.RUNNING,
        ready: health.ready,
        tcpState: health.transports.tcp.state,
        rtuState: health.transports.rtu.state,
        tcpError: health.transports.tcp.error,
        rtuError: health.transports.rtu.error
      })
      setConfig(health.desiredConfig)
    } catch (cause) {
      captureError(cause, true)
    }
  }, [captureError])

  const fetchConfig = useCallback(async () => {
    try {
      const data = await controlRequest<ConfigResponse>('/api/v1/config')
      setConfig(data.desired)
    } catch (cause) {
      captureError(cause, true)
    }
  }, [captureError])

  const fetchSerialPorts = useCallback(async () => {
    try {
      setSerialPorts(await controlRequest<SerialPortInfo[]>('/api/v1/serial-ports'))
    } catch (cause) {
      captureError(cause, true)
    }
  }, [captureError])

  const fetchTcpClients = useCallback(async () => {
    try {
      const data = await controlRequest<{ clients: TcpClientInfo[] }>('/api/v1/tcp-clients')
      setTcpClients(data.clients)
    } catch (cause) {
      captureError(cause, true)
    }
  }, [captureError])

  const disconnectTcpClient = useCallback(
    async (id: number) => {
      try {
        await controlRequest(`/api/v1/tcp-clients/${id}`, { method: 'DELETE' })
        await fetchTcpClients()
        await fetchLogs()
      } catch (cause) {
        captureError(cause)
      }
    },
    [captureError, fetchLogs, fetchTcpClients]
  )

  const disconnectAllTcpClients = useCallback(async () => {
    try {
      await controlRequest('/api/v1/tcp-clients', { method: 'DELETE' })
      await fetchTcpClients()
      await fetchLogs()
    } catch (cause) {
      captureError(cause)
    }
  }, [captureError, fetchLogs, fetchTcpClients])

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
        const table = tableForRegisterType(payload.registerType)
        const body =
          payload.mode === 'bytes'
            ? { address: payload.startAddress, bytes: payload.hexString }
            : { address: payload.startAddress, dataType: payload.dataType, value: payload.value }
        await controlRequest(`/api/v1/registers/${table}/encoded`, {
          method: 'PUT',
          body: JSON.stringify(body)
        })
        await fetchState()
        await fetchLogs()
      } catch (cause) {
        captureError(cause)
      }
    },
    [captureError, fetchLogs, fetchState]
  )

  const writeRegister = useCallback(
    async (registerType: string, address: number, value: number | boolean) => {
      try {
        const table = tableForRegisterType(registerType)
        await controlRequest(`/api/v1/registers/${table}`, {
          method: 'PUT',
          body: JSON.stringify({ start: address, values: [value] })
        })
        await fetchState()
        await fetchLogs()
      } catch (cause) {
        captureError(cause)
      }
    },
    [captureError, fetchLogs, fetchState]
  )

  const updateConfig = useCallback(
    async (newConfig: Omit<ServerConfig, 'tcpHost' | 'logFilter'>) => {
      try {
        const data = await controlRequest<ConfigResponse>('/api/v1/config', {
          method: 'PATCH',
          body: JSON.stringify({ ...newConfig, tcpHost: config.tcpHost })
        })
        setConfig(data.desired)
        await fetchHealth()
      } catch (cause) {
        captureError(cause)
      }
    },
    [captureError, config.tcpHost, fetchHealth]
  )

  const updateLogFilter = useCallback(
    async (newFilter: Partial<LogFilterConfig>) => {
      try {
        const logFilter = { ...config.logFilter, ...newFilter }
        const data = await controlRequest<ConfigResponse>('/api/v1/config', {
          method: 'PATCH',
          body: JSON.stringify({ logFilter })
        })
        setConfig(data.desired)
      } catch (cause) {
        captureError(cause)
      }
    },
    [captureError, config.logFilter]
  )

  const clearLogs = useCallback(async () => {
    try {
      await controlRequest('/api/v1/logs', { method: 'DELETE' })
      setLogs([])
    } catch (cause) {
      captureError(cause)
    }
  }, [captureError])

  const authenticate = useCallback(
    async (token: string) => {
      setIsAuthenticating(true)
      setAuthError(null)
      try {
        await validateAndStoreControlToken(token)
        setRequiresToken(false)
        await Promise.all([
          fetchState(),
          fetchLogs(),
          fetchHealth(),
          fetchConfig(),
          fetchSerialPorts(),
          fetchTcpClients()
        ])
      } catch (cause) {
        setAuthError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        setIsAuthenticating(false)
      }
    },
    [fetchConfig, fetchHealth, fetchLogs, fetchSerialPorts, fetchState, fetchTcpClients]
  )

  useEffect(() => {
    const initialPoll = setTimeout(() => {
      void Promise.all([
        fetchState(),
        fetchLogs(),
        fetchHealth(),
        fetchConfig(),
        fetchSerialPorts(),
        fetchTcpClients()
      ])
    }, 0)
    const interval = setInterval(() => {
      if (!requiresToken)
        void Promise.all([fetchState(), fetchLogs(), fetchHealth(), fetchTcpClients()])
    }, POLL_INTERVAL)
    return () => {
      clearTimeout(initialPoll)
      clearInterval(interval)
    }
  }, [
    fetchConfig,
    fetchHealth,
    fetchLogs,
    fetchSerialPorts,
    fetchState,
    fetchTcpClients,
    requiresToken
  ])

  return {
    state,
    logs,
    status,
    config,
    serialPorts,
    logFilter: config.logFilter,
    tcpClients,
    error,
    requiresToken,
    authError,
    isAuthenticating,
    authenticate,
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
