import { ServerTCP } from 'modbus-serial'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getTCPHost,
  getTCPPort,
  isTCPServerRunning,
  startTCPServer,
  stopTCPServer,
  waitForTCPServerReady
} from './tcp-server'

function createMockServer() {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
  return {
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      listeners[event] = listeners[event] || []
      listeners[event].push(cb)
    }),
    once: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      listeners[event] = listeners[event] || []
      listeners[event].push(cb)
    }),
    close: vi.fn(() => {
      const cbs = listeners.close || []
      listeners.close = []
      cbs.forEach((cb) => {
        cb()
      })
    }),
    removeListener: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((l) => l !== cb)
      }
    }),
    emit(event: string, ...args: unknown[]) {
      for (const callback of listeners[event] ?? []) callback(...args)
    }
  }
}

let mockServer = createMockServer()

vi.mock('modbus-serial', () => ({
  ServerTCP: vi.fn(function ServerTCP() {
    return mockServer
  })
}))

describe('tcp-server', () => {
  beforeEach(async () => {
    await stopTCPServer()
    mockServer = createMockServer()
    vi.clearAllMocks()
  })

  it('reports running only after listener initialization', async () => {
    const server = startTCPServer()
    expect(server).toBe(mockServer)
    expect(isTCPServerRunning()).toBe(false)
    expect(getTCPPort()).toBe(502)
    expect(getTCPHost()).toBe('127.0.0.1')
    mockServer.emit('initialized')
    await expect(waitForTCPServerReady()).resolves.toBeUndefined()
    expect(isTCPServerRunning()).toBe(true)
  })

  it('should start a TCP server with custom port', () => {
    startTCPServer(1502)
    expect(getTCPPort()).toBe(1502)
  })

  it('should fall back to env MODBUS_TCP_PORT', () => {
    const original = process.env.MODBUS_TCP_PORT
    process.env.MODBUS_TCP_PORT = '11502'
    startTCPServer()
    expect(getTCPPort()).toBe(11502)
    process.env.MODBUS_TCP_PORT = original
  })

  it('should not start a second server if already running', () => {
    const first = startTCPServer(1502)
    const second = startTCPServer(1602)
    expect(first).toBe(second)
    expect(getTCPPort()).toBe(1502)
  })

  it('should report not running after stop', async () => {
    startTCPServer()
    mockServer.emit('initialized')
    expect(isTCPServerRunning()).toBe(true)
    await stopTCPServer()
    expect(isTCPServerRunning()).toBe(false)
  })

  it('should stop idempotently', async () => {
    await stopTCPServer()
    expect(isTCPServerRunning()).toBe(false)
  })

  it('should pass vector callbacks to ServerTCP', () => {
    startTCPServer(1502, 5)
    expect(ServerTCP).toHaveBeenCalledWith(
      expect.objectContaining({
        getCoil: expect.any(Function),
        getCoils: expect.any(Function),
        getDiscreteInput: expect.any(Function),
        getDiscreteInputs: expect.any(Function),
        getInputRegister: expect.any(Function),
        getInputRegisters: expect.any(Function),
        getHoldingRegister: expect.any(Function),
        getHoldingRegisters: expect.any(Function),
        setCoil: expect.any(Function),
        setRegister: expect.any(Function)
      }),
      { host: '127.0.0.1', port: 1502, debug: false, unitID: 5 }
    )
  })

  it('rejects readiness and records non-running state on bind failure', async () => {
    startTCPServer(1502, 1, '0.0.0.0')
    const readiness = waitForTCPServerReady()
    mockServer.emit('serverError', new Error('EADDRINUSE'))
    await expect(readiness).rejects.toThrow('EADDRINUSE')
    expect(isTCPServerRunning()).toBe(false)
    expect(getTCPHost()).toBe('0.0.0.0')
  })
})
