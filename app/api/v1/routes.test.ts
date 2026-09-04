import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModbusEngine } from '@/src/lib/modbus/engine'
import { GET as configGet, PATCH as configPatch } from './config/route'
import { GET as healthGet } from './health/route'
import { DELETE as logsDelete, GET as logsGet } from './logs/route'
import { GET as openApiGet } from './openapi.json/route'
import { PUT as encodedPut } from './registers/[table]/encoded/route'
import { GET as rangeGet, PUT as rangePut } from './registers/[table]/route'
import { GET as discoveryGet } from './route'
import { POST as resetPost } from './state/reset/route'
import { GET as stateGet } from './state/route'
import { DELETE as clientsDelete, GET as clientsGet } from './tcp-clients/route'

vi.mock('@/src/lib/modbus', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/src/lib/modbus')>()
  return { ...original, ensureServersStarted: vi.fn().mockResolvedValue(undefined) }
})

const routeContext = (params: Record<string, string>) => ({ params: Promise.resolve(params) })

async function data(response: Response) {
  return (await response.json()).data
}

describe('v1 control routes', () => {
  beforeEach(() => {
    delete process.env.MODBUS_API_TOKEN
    ModbusEngine.resetInstance()
  })

  it('provides public discovery/OpenAPI and stable instance health metadata', async () => {
    const discovery = await discoveryGet(new Request('http://127.0.0.1/api/v1'), routeContext({}))
    expect(await data(discovery)).toMatchObject({
      apiVersion: '1',
      openapi: '/api/v1/openapi.json'
    })
    const openApi = await openApiGet(
      new Request('http://127.0.0.1/api/v1/openapi.json'),
      routeContext({})
    )
    expect(await openApi.json()).toMatchObject({ openapi: '3.1.0' })
    const first = await healthGet(new Request('http://127.0.0.1/api/v1/health'), routeContext({}))
    const second = await healthGet(new Request('http://127.0.0.1/api/v1/health'), routeContext({}))
    expect((await first.json()).meta.instanceId).toBe((await second.json()).meta.instanceId)
  })

  it('returns full state and deterministic selective resets', async () => {
    ModbusEngine.getInstance().writeHoldingRegister(0, 42)
    expect(
      (await data(await stateGet(new Request('http://127.0.0.1/api/v1/state'), routeContext({}))))
        .holdingRegisters[0]
    ).toBe(42)
    const reset = await resetPost(
      new Request('http://127.0.0.1/api/v1/state/reset', {
        method: 'POST',
        body: JSON.stringify({ tables: ['holding-registers'], clearLogs: true })
      }),
      routeContext({})
    )
    expect(reset.status).toBe(200)
    expect(ModbusEngine.getInstance().getState().holdingRegisters[0]).toBe(0)
    expect(ModbusEngine.getInstance().getLogs()).toEqual([])
  })

  it('reads and atomically writes all public table kinds with API log source', async () => {
    for (const [table, values] of [
      ['coils', [true, false]],
      ['discrete-inputs', [false, true]],
      ['holding-registers', [10, 20]],
      ['input-registers', [30, 40]]
    ] as const) {
      const response = await rangePut(
        new Request(`http://127.0.0.1/api/v1/registers/${table}`, {
          method: 'PUT',
          body: JSON.stringify({ start: 0, values })
        }),
        routeContext({ table })
      )
      expect(response.status).toBe(200)
      const read = await rangeGet(
        new Request(`http://127.0.0.1/api/v1/registers/${table}?start=0&count=2`),
        routeContext({ table })
      )
      expect((await data(read)).values).toEqual(values)
    }
    expect(
      ModbusEngine.getInstance()
        .getLogs()
        .some((entry) => entry.source?.type === 'api')
    ).toBe(true)

    const invalid = await rangePut(
      new Request('http://127.0.0.1/api/v1/registers/holding-registers', {
        method: 'PUT',
        body: JSON.stringify({ start: 1, values: [5, -1] })
      }),
      routeContext({ table: 'holding-registers' })
    )
    expect(invalid.status).toBe(422)
    expect(ModbusEngine.getInstance().getState().holdingRegisters[1]).toBe(20)
  })

  it('supports encoded writes, cursor logs, config and client collections', async () => {
    expect(
      (
        await encodedPut(
          new Request('http://127.0.0.1/api/v1/registers/input-registers/encoded', {
            method: 'PUT',
            body: JSON.stringify({ address: 5, bytes: '12 34 AB CD' })
          }),
          routeContext({ table: 'input-registers' })
        )
      ).status
    ).toBe(200)
    const logs = await logsGet(
      new Request('http://127.0.0.1/api/v1/logs?afterId=0&limit=10&type=write&source=api'),
      routeContext({})
    )
    expect((await data(logs)).entries.length).toBeGreaterThan(0)
    expect(
      (await configGet(new Request('http://127.0.0.1/api/v1/config'), routeContext({}))).status
    ).toBe(200)
    expect(
      (
        await configPatch(
          new Request('http://127.0.0.1/api/v1/config', {
            method: 'PATCH',
            body: JSON.stringify({ logMaxCount: 2000 })
          }),
          routeContext({})
        )
      ).status
    ).toBe(200)
    expect(
      (await clientsGet(new Request('http://127.0.0.1/api/v1/tcp-clients'), routeContext({})))
        .status
    ).toBe(200)
    expect(
      (
        await clientsDelete(
          new Request('http://127.0.0.1/api/v1/tcp-clients', { method: 'DELETE' }),
          routeContext({})
        )
      ).status
    ).toBe(200)
    expect(
      (
        await logsDelete(
          new Request('http://127.0.0.1/api/v1/logs', { method: 'DELETE' }),
          routeContext({})
        )
      ).status
    ).toBe(200)
    expect(ModbusEngine.getInstance().getLogs()).toEqual([])
  })
})
