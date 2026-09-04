import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureServersStarted, getConfig, restartServers, setConfig } from './index'

const coordinator = vi.hoisted(() => ({
  ensureStarted: vi.fn().mockResolvedValue(undefined),
  restartAll: vi.fn().mockResolvedValue(undefined),
  getConfig: vi.fn(() => ({ tcpHost: '127.0.0.1', tcpPort: 502 })),
  applyConfig: vi.fn().mockResolvedValue({})
}))

vi.mock('./lifecycle', () => ({ getRuntimeCoordinator: () => coordinator }))
vi.mock('./tcp-server', () => ({
  disconnectAllTCPClients: vi.fn(),
  disconnectTCPClient: vi.fn(),
  getTCPClients: vi.fn(),
  getTCPHost: vi.fn(),
  getTCPPort: vi.fn(),
  isTCPServerRunning: vi.fn()
}))
vi.mock('./rtu-serial-server', () => ({
  getRTUSerialPath: vi.fn(),
  isRTUSerialServerRunning: vi.fn()
}))

describe('modbus server manager', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllEnvs())

  it('routes startup and restarts through the coordinator', async () => {
    await ensureServersStarted()
    await restartServers()
    expect(coordinator.ensureStarted).toHaveBeenCalledOnce()
    expect(coordinator.restartAll).toHaveBeenCalledOnce()
  })

  it('does not create transport listeners while Next.js is building route bundles', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build')
    await ensureServersStarted()
    expect(coordinator.ensureStarted).not.toHaveBeenCalled()
  })

  it('does not create transport listeners inside a Next.js build worker', async () => {
    vi.stubEnv('NEXT_PRIVATE_BUILD_WORKER', '1')
    await ensureServersStarted()
    expect(coordinator.ensureStarted).not.toHaveBeenCalled()
  })

  it('does not create transport listeners inside generic Next.js compiler workers', async () => {
    vi.stubEnv('IS_NEXT_WORKER', 'true')
    await ensureServersStarted()
    expect(coordinator.ensureStarted).not.toHaveBeenCalled()
  })

  it('does not create transport listeners inside Next.js jest-worker children', async () => {
    vi.stubEnv('JEST_WORKER_ID', '1')
    await ensureServersStarted()
    expect(coordinator.ensureStarted).not.toHaveBeenCalled()
  })

  it('reads and applies desired configuration through the coordinator', async () => {
    expect(getConfig()).toEqual({ tcpHost: '127.0.0.1', tcpPort: 502 })
    await setConfig({ tcpPort: 1502 })
    expect(coordinator.applyConfig).toHaveBeenCalledWith({ tcpPort: 1502 })
  })
})
