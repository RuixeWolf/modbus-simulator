import type { Socket } from 'node:net'
import { ServerTCP } from 'modbus-serial'
import { ModbusEngine } from './engine'
import { logSourceStore } from './log-context'

/** Metadata for an active TCP client connection. */
export interface TcpClientInfo {
  id: number
  host: string
  port: number
  connectedAt: string
}

/** Internal record pairing client metadata with its live socket. */
interface TcpClientRecord {
  info: TcpClientInfo
  socket: Socket
  /** True if a disconnect log has already been written for this client. */
  logged: boolean
}

const g = globalThis as typeof globalThis & {
  __modbus_tcp_server__?: ServerTCP | null
  __modbus_tcp_running__?: boolean
  __modbus_tcp_port__?: number
  __modbus_tcp_clients__?: Map<number, TcpClientRecord>
  __modbus_tcp_next_client_id__?: number
}

/** Returns the active client map stored on globalThis (survives module reloads). */
function getClientMap(): Map<number, TcpClientRecord> {
  return g.__modbus_tcp_clients__ ?? new Map()
}

/** Returns the next client ID from globalThis. */
function getNextClientId(): number {
  return g.__modbus_tcp_next_client_id__ ?? 1
}

/** Stores the next client ID on globalThis. */
function setNextClientId(id: number): void {
  g.__modbus_tcp_next_client_id__ = id
}

/** Returns the active server stored on globalThis. */
function getServer(): ServerTCP | null {
  return g.__modbus_tcp_server__ ?? null
}

/** Stores the server on globalThis. */
function setServer(s: ServerTCP | null): void {
  g.__modbus_tcp_server__ = s
  server = s
}

/** Active TCP server instance, or null when stopped. */
let server: ServerTCP | null = getServer()
/** Port the server was most recently started on. */
let currentPort: number = g.__modbus_tcp_port__ ?? 502

/**
 * Starts a Modbus TCP server backed by the singleton ModbusEngine.
 * If the server is already running the existing instance is returned.
 *
 * @param port    – TCP port to listen on (default 502).
 * @param slaveId – Modbus slave ID / unit ID (default 1, range 1-247).
 * @returns The started ServerTCP instance.
 */
export function startTCPServer(port?: number, slaveId?: number): ServerTCP {
  if (server) {
    return server
  }
  currentPort = port ?? (Number(process.env.MODBUS_TCP_PORT) || 502)
  const unitID = slaveId ?? 1

  const engine = ModbusEngine.getInstance()

  const vector = {
    getCoil(addr: number, _unitID: number, callback: (err: Error | null, value: boolean) => void) {
      try {
        callback(null, engine.readCoil(addr))
      } catch (e) {
        engine.addErrorLog('coil', addr, (e as Error).message)
        callback(e as Error, false)
      }
    },
    getCoils(
      addr: number,
      length: number,
      _unitID: number,
      callback: (err: Error | null, values: boolean[]) => void
    ) {
      try {
        callback(null, engine.readCoils(addr, length))
      } catch (e) {
        engine.addErrorLog('coil', addr, (e as Error).message)
        callback(e as Error, [])
      }
    },
    getDiscreteInput(
      addr: number,
      _unitID: number,
      callback: (err: Error | null, value: boolean) => void
    ) {
      try {
        callback(null, engine.readDiscreteInput(addr))
      } catch (e) {
        engine.addErrorLog('discreteInput', addr, (e as Error).message)
        callback(e as Error, false)
      }
    },
    getDiscreteInputs(
      addr: number,
      length: number,
      _unitID: number,
      callback: (err: Error | null, values: boolean[]) => void
    ) {
      try {
        callback(null, engine.readDiscreteInputs(addr, length))
      } catch (e) {
        engine.addErrorLog('discreteInput', addr, (e as Error).message)
        callback(e as Error, [])
      }
    },
    getInputRegister(
      addr: number,
      _unitID: number,
      callback: (err: Error | null, value: number) => void
    ) {
      try {
        callback(null, engine.readInputRegister(addr))
      } catch (e) {
        engine.addErrorLog('inputRegister', addr, (e as Error).message)
        callback(e as Error, 0)
      }
    },
    getInputRegisters(
      addr: number,
      length: number,
      _unitID: number,
      callback: (err: Error | null, values: number[]) => void
    ) {
      try {
        callback(null, engine.readInputRegisters(addr, length))
      } catch (e) {
        engine.addErrorLog('inputRegister', addr, (e as Error).message)
        callback(e as Error, [])
      }
    },
    getHoldingRegister(
      addr: number,
      _unitID: number,
      callback: (err: Error | null, value: number) => void
    ) {
      try {
        callback(null, engine.readHoldingRegister(addr))
      } catch (e) {
        engine.addErrorLog('holdingRegister', addr, (e as Error).message)
        callback(e as Error, 0)
      }
    },
    getHoldingRegisters(
      addr: number,
      length: number,
      _unitID: number,
      callback: (err: Error | null, values: number[]) => void
    ) {
      try {
        callback(null, engine.readHoldingRegisters(addr, length))
      } catch (e) {
        engine.addErrorLog('holdingRegister', addr, (e as Error).message)
        callback(e as Error, [])
      }
    },
    setCoil(addr: number, value: boolean, _unitID: number, callback: (err: Error | null) => void) {
      try {
        engine.writeCoil(addr, value)
        callback(null)
      } catch (e) {
        engine.addErrorLog('coil', addr, (e as Error).message)
        callback(e as Error)
      }
    },
    setRegister(
      addr: number,
      value: number,
      _unitID: number,
      callback: (err: Error | null) => void
    ) {
      try {
        engine.writeHoldingRegister(addr, value)
        callback(null)
      } catch (e) {
        engine.addErrorLog('holdingRegister', addr, (e as Error).message)
        callback(e as Error)
      }
    }
  }

  const newServer = new ServerTCP(vector, {
    host: '0.0.0.0',
    port: currentPort,
    debug: false,
    unitID
  })
  setServer(newServer)
  g.__modbus_tcp_running__ = true
  g.__modbus_tcp_port__ = currentPort

  // Patch socket.emit so that 'data' events carry AsyncLocalStorage context
  // through modbus-serial's setTimeout → vector callbacks → engine.addLog.
  // Also track active client connections for the management UI.
  const netServer = (newServer as unknown as { _server?: import('node:net').Server })._server
  if (netServer) {
    netServer.on('connection', (sock: Socket) => {
      const host = sock.remoteAddress ?? 'unknown'
      const port = sock.remotePort ?? 0
      const source = {
        type: 'tcp' as const,
        detail: `${host}:${port}`
      }

      // Track client connection using globalThis so data survives module reloads
      const clients = getClientMap()
      const clientId = getNextClientId()
      setNextClientId(clientId + 1)
      const clientInfo: TcpClientInfo = {
        id: clientId,
        host,
        port,
        connectedAt: new Date().toISOString()
      }
      clients.set(clientId, { info: clientInfo, socket: sock, logged: false })
      g.__modbus_tcp_clients__ = clients

      engine.addConnectionLog(host, port, 'connected')

      sock.once('close', () => {
        const record = clients.get(clientId)
        if (record && !record.logged) {
          engine.addConnectionLog(record.info.host, record.info.port, 'disconnected')
        }
        clients.delete(clientId)
      })

      const originalEmit = sock.emit.bind(sock)
      sock.emit = ((event: string | symbol, ...args: unknown[]) => {
        if (event === 'data') {
          return logSourceStore.run(source, () => originalEmit(event, ...args))
        }
        return originalEmit(event, ...args)
      }) as typeof sock.emit
    })
  } else {
    console.warn(
      'Modbus TCP: Unable to access internal net.Server for socket patching. ' +
        'Log source tracking for TCP requests will be unavailable.'
    )
  }

  newServer.on('serverError', (err: Error) => {
    console.error('Modbus TCP Server error:', err.message)
  })

  console.log(`Modbus TCP Server started on port ${currentPort} (slave ID ${unitID})`)
  return newServer
}

/** Stops and clears the active TCP server, if any. Returns a Promise that resolves once the server is closed. */
export function stopTCPServer(): Promise<void> {
  return new Promise((resolve) => {
    const currentServer = getServer()
    if (!currentServer) {
      resolve()
      return
    }

    g.__modbus_tcp_running__ = false
    setServer(null)

    // Log disconnects for all active clients before clearing the map.
    const clients = getClientMap()
    for (const [id, record] of clients) {
      ModbusEngine.getInstance().addConnectionLog(
        record.info.host,
        record.info.port,
        'disconnected'
      )
      clients.delete(id)
    }
    getClientMap().clear()
    g.__modbus_tcp_clients__ = new Map()

    let resolved = false

    const timeout = setTimeout(() => {
      if (resolved) return
      resolved = true
      currentServer.removeListener('close', onClose)
      resolve()
    }, 5000)
    timeout.unref()

    function onClose() {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      console.log('Modbus TCP Server stopped')
      resolve()
    }

    currentServer.once('close', onClose)
    currentServer.close()
  })
}

/** @returns Whether the TCP server is currently running. */
export function isTCPServerRunning(): boolean {
  return g.__modbus_tcp_running__ ?? false
}

/** @returns The port the TCP server was most recently started on. */
export function getTCPPort(): number {
  return g.__modbus_tcp_port__ ?? 502
}

/**
 * @returns A snapshot of all currently connected TCP clients,
 *          sorted by connection time (oldest first).
 */
export function getTCPClients(): TcpClientInfo[] {
  return Array.from(getClientMap().values())
    .map((record) => record.info)
    .sort((a, b) => new Date(a.connectedAt).getTime() - new Date(b.connectedAt).getTime())
}

/**
 * Forcibly disconnects a single TCP client by its ID.
 * @param id – Client ID returned by {@link getTCPClients}.
 * @returns True if the client existed and was disconnected.
 */
export function disconnectTCPClient(id: number): boolean {
  const clients = getClientMap()
  const record = clients.get(id)
  if (!record) return false
  const engine = ModbusEngine.getInstance()
  engine.addConnectionLog(record.info.host, record.info.port, 'disconnected')
  record.logged = true
  record.socket.destroy()
  clients.delete(id)
  return true
}

/**
 * Forcibly disconnects all active TCP clients.
 * @returns The number of clients that were disconnected.
 */
export function disconnectAllTCPClients(): number {
  const clients = getClientMap()
  const engine = ModbusEngine.getInstance()
  let count = 0
  for (const [id, record] of clients) {
    engine.addConnectionLog(record.info.host, record.info.port, 'disconnected')
    record.logged = true
    record.socket.destroy()
    clients.delete(id)
    count++
  }
  return count
}
