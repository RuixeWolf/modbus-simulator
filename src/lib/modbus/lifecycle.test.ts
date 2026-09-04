import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModbusEngine } from './engine'
import { RuntimeCoordinator } from './lifecycle'

const mocks = vi.hoisted(() => ({
  tcpRunning: false,
  rtuRunning: false,
  tcpFailure: null as Error | null,
  rtuFailure: null as Error | null,
  clientsCount: 0,
  startTcp: vi.fn(() => {
    mocks.tcpRunning = true
  }),
  stopTcp: vi.fn(async () => {
    mocks.tcpRunning = false
  }),
  startRtu: vi.fn(() => {
    mocks.rtuRunning = true
  }),
  stopRtu: vi.fn(async () => {
    mocks.rtuRunning = false
  })
}))

vi.mock('./tcp-server', () => ({
  startTCPServer: mocks.startTcp,
  stopTCPServer: mocks.stopTcp,
  waitForTCPServerReady: vi.fn(async () => {
    if (mocks.tcpFailure) throw mocks.tcpFailure
  }),
  isTCPServerRunning: vi.fn(() => mocks.tcpRunning),
  getTCPError: vi.fn(() => mocks.tcpFailure?.message ?? null),
  getTCPClients: vi.fn(() =>
    Array.from({ length: mocks.clientsCount }, (_, index) => ({ id: index + 1 }))
  ),
  disconnectAllTCPClients: vi.fn(() => 0)
}))

vi.mock('./rtu-serial-server', () => ({
  startRTUSerialServer: mocks.startRtu,
  stopRTUSerialServer: mocks.stopRtu,
  waitForRTUSerialServerReady: vi.fn(async () => {
    if (mocks.rtuFailure) throw mocks.rtuFailure
  }),
  isRTUSerialServerRunning: vi.fn(() => mocks.rtuRunning),
  getRTUError: vi.fn(() => mocks.rtuFailure?.message ?? null)
}))

describe('RuntimeCoordinator', () => {
  beforeEach(() => {
    RuntimeCoordinator.resetInstanceForTests()
    ModbusEngine.resetInstance()
    mocks.tcpRunning = false
    mocks.rtuRunning = false
    mocks.tcpFailure = null
    mocks.rtuFailure = null
    mocks.clientsCount = 0
    mocks.startTcp.mockClear()
    mocks.stopTcp.mockClear()
    mocks.startRtu.mockClear()
    mocks.stopRtu.mockClear()
    delete process.env.MODBUS_RTU_SERIAL_PATH
    delete process.env.MODBUS_API_TOKEN
  })

  it('reuses stable process identity and concurrent startup', async () => {
    const coordinator = RuntimeCoordinator.getInstance()
    await Promise.all([
      coordinator.ensureStarted(),
      coordinator.ensureStarted(),
      coordinator.ensureStarted()
    ])
    expect(RuntimeCoordinator.getInstance()).toBe(coordinator)
    expect(RuntimeCoordinator.getInstance().instanceId).toBe(coordinator.instanceId)
    expect(mocks.startTcp).toHaveBeenCalledOnce()
    expect(coordinator.getHealth('1.1.0', '1')).toMatchObject({
      ready: true,
      transports: { tcp: { state: 'running' }, rtu: { state: 'disabled' } }
    })
  })

  it('serializes overlapping configuration transitions in order', async () => {
    const coordinator = RuntimeCoordinator.getInstance()
    await coordinator.ensureStarted()
    const first = coordinator.applyConfig({ tcpPort: 1502 })
    const second = coordinator.applyConfig({ tcpPort: 1602 })
    await Promise.all([first, second])
    expect(coordinator.getConfig().tcpPort).toBe(1602)
    expect(mocks.startTcp.mock.calls.at(-1)).toEqual([1602, 1, '127.0.0.1'])
  })

  it('does not restart transports for log-only patches', async () => {
    const coordinator = RuntimeCoordinator.getInstance()
    await coordinator.ensureStarted()
    mocks.startTcp.mockClear()
    const result = await coordinator.applyConfig({ logMaxCount: 2000 })
    expect(result).toEqual({ tcpRestarted: false, rtuRestarted: false, tcpClientsDisconnected: 0 })
    expect(mocks.startTcp).not.toHaveBeenCalled()
  })

  it('restarts only affected transports and reports disconnected TCP clients', async () => {
    const coordinator = RuntimeCoordinator.getInstance()
    await coordinator.ensureStarted()
    mocks.clientsCount = 2
    mocks.startTcp.mockClear()
    mocks.startRtu.mockClear()
    const tcpResult = await coordinator.applyConfig({ tcpPort: 1502 })
    expect(tcpResult).toMatchObject({
      tcpRestarted: true,
      rtuRestarted: false,
      tcpClientsDisconnected: 2
    })
    expect(mocks.startRtu).not.toHaveBeenCalled()

    const rtuResult = await coordinator.applyConfig({ rtuEnabled: true, rtuSerialPath: 'COM7' })
    expect(rtuResult).toMatchObject({ tcpRestarted: false, rtuRestarted: true })
    expect(mocks.startRtu).toHaveBeenCalledOnce()
  })

  it('retains desired configuration and exposes error state after bind failure', async () => {
    const coordinator = RuntimeCoordinator.getInstance()
    await coordinator.ensureStarted()
    mocks.tcpFailure = new Error('address already in use')
    await expect(coordinator.applyConfig({ tcpPort: 1702 })).rejects.toMatchObject({ status: 503 })
    expect(coordinator.getConfig().tcpPort).toBe(1702)
    expect(coordinator.getLifecycle().tcp).toMatchObject({
      state: 'error',
      error: 'address already in use'
    })
    expect(
      ModbusEngine.getInstance()
        .getLogs()
        .map((entry) => entry.message)
        .join(' ')
    ).not.toContain('secret-token')
  })

  it('keeps health available in degraded startup and emits secret-free system logs', async () => {
    process.env.MODBUS_API_TOKEN = 'secret-token'
    mocks.tcpFailure = new Error('EADDRINUSE')
    const coordinator = RuntimeCoordinator.getInstance()
    await expect(coordinator.ensureStarted()).resolves.toBeUndefined()
    expect(coordinator.getHealth('1.1.0', '1')).toMatchObject({
      ready: false,
      transports: { tcp: { state: 'error', error: 'EADDRINUSE' }, rtu: { state: 'disabled' } }
    })
    const logs = ModbusEngine.getInstance().getLogs()
    expect(logs.some((entry) => entry.type === 'system' && entry.message?.includes('failed'))).toBe(
      true
    )
    expect(JSON.stringify(logs)).not.toContain('secret-token')
  })
})
