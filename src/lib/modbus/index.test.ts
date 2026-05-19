import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./tcp-server', () => ({
  startTCPServer: vi.fn(),
  stopTCPServer: vi.fn().mockResolvedValue(undefined),
  isTCPServerRunning: vi.fn().mockReturnValue(false),
  getTCPPort: vi.fn().mockReturnValue(502)
}))

vi.mock('./rtu-serial-server', () => ({
  startRTUSerialServer: vi.fn(),
  stopRTUSerialServer: vi.fn().mockResolvedValue(undefined),
  isRTUSerialServerRunning: vi.fn().mockReturnValue(false),
  getRTUSerialPath: vi.fn().mockReturnValue('')
}))

describe('modbus server manager', () => {
  beforeEach(async () => {
    vi.resetModules()
    const g = globalThis as typeof globalThis & { __modbus_initialized__?: boolean }
    g.__modbus_initialized__ = false
    vi.clearAllMocks()
  })

  it('should return default config', async () => {
    const { getConfig } = await import('./index')
    const config = getConfig()
    expect(config).toEqual({
      tcpEnabled: true,
      tcpPort: 502,
      slaveId: 1,
      rtuEnabled: true,
      rtuSerialPath: null,
      rtuBaudRate: 9600,
      rtuParity: 'none',
      rtuDataBits: 8,
      rtuStopBits: 1
    })
  })

  it('should update config fields', async () => {
    const { getConfig, setConfig } = await import('./index')
    setConfig({ tcpPort: 1502, slaveId: 5 })
    const config = getConfig()
    expect(config.tcpPort).toBe(1502)
    expect(config.slaveId).toBe(5)
    expect(config.rtuBaudRate).toBe(9600)
  })

  it('should start TCP server via ensureServersStarted', async () => {
    const { ensureServersStarted } = await import('./index')
    const { startTCPServer } = await import('./tcp-server')
    ensureServersStarted()
    expect(startTCPServer).toHaveBeenCalledWith(502, 1)
  })

  it('should start both servers via startServers when RTU path is set', async () => {
    const { startServers, setConfig } = await import('./index')
    const { startTCPServer } = await import('./tcp-server')
    const { startRTUSerialServer } = await import('./rtu-serial-server')
    setConfig({ rtuSerialPath: 'COM3' })
    startServers()
    expect(startTCPServer).toHaveBeenCalledWith(502, 1)
    expect(startRTUSerialServer).toHaveBeenCalledWith('COM3', {
      baudRate: 9600,
      parity: 'none',
      dataBits: 8,
      stopBits: 1,
      slaveId: 1
    })
  })

  it('should not start RTU server when path is null', async () => {
    const { startServers, setConfig } = await import('./index')
    const { startRTUSerialServer } = await import('./rtu-serial-server')
    setConfig({ rtuSerialPath: null })
    startServers()
    expect(startRTUSerialServer).not.toHaveBeenCalled()
  })

  it('should restart TCP server on restartServers', async () => {
    const { restartServers } = await import('./index')
    const { startTCPServer, stopTCPServer, isTCPServerRunning } = await import('./tcp-server')
    vi.mocked(isTCPServerRunning).mockReturnValue(true)
    await restartServers()
    expect(stopTCPServer).toHaveBeenCalled()
    expect(startTCPServer).toHaveBeenCalledWith(502, 1)
  })

  it('should not start TCP server when tcpEnabled is false', async () => {
    const { startServers, setConfig } = await import('./index')
    const { startTCPServer } = await import('./tcp-server')
    setConfig({ tcpEnabled: false })
    startServers()
    expect(startTCPServer).not.toHaveBeenCalled()
  })

  it('should stop TCP server on restart when disabled', async () => {
    const { restartServers, setConfig } = await import('./index')
    const { stopTCPServer, isTCPServerRunning } = await import('./tcp-server')
    vi.mocked(isTCPServerRunning).mockReturnValue(true)
    setConfig({ tcpEnabled: false })
    await restartServers()
    expect(stopTCPServer).toHaveBeenCalled()
  })
})
