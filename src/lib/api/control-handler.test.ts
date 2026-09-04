import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { CONTROL_ERROR_CODE, ControlError } from '@/src/lib/modbus/control/errors'
import { withControlApi } from './control-handler'

const originalToken = process.env.MODBUS_API_TOKEN
const routeContext = { params: Promise.resolve({}) }

afterEach(() => {
  process.env.MODBUS_API_TOKEN = originalToken
})

describe('withControlApi', () => {
  it('allows public discovery and emits standard no-store envelopes', async () => {
    process.env.MODBUS_API_TOKEN = 'secret-value'
    const handler = withControlApi({ public: true }, () => ({ ok: true }))
    const response = await handler(new Request('http://127.0.0.1/api/v1'), routeContext)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toMatchObject({ data: { ok: true }, meta: { apiVersion: '1' } })
  })

  it('protects operations and never includes the configured token', async () => {
    process.env.MODBUS_API_TOKEN = 'secret-value'
    const handler = withControlApi({}, () => ({ ok: true }))
    const response = await handler(new Request('http://127.0.0.1/api/v1/health'), routeContext)
    expect(response.status).toBe(401)
    expect(JSON.stringify(await response.json())).not.toContain('secret-value')

    const authorized = await handler(
      new Request('http://127.0.0.1/api/v1/health', {
        headers: { Authorization: 'Bearer secret-value' }
      }),
      routeContext
    )
    expect(authorized.status).toBe(200)
  })

  it('distinguishes malformed JSON, validation, origin and domain errors', async () => {
    delete process.env.MODBUS_API_TOKEN
    const handler = withControlApi(
      { body: z.strictObject({ value: z.number().int().positive() }) },
      ({ body }) => body
    )
    const malformed = await handler(
      new Request('http://127.0.0.1/api/v1/test', { method: 'POST', body: '{' }),
      routeContext
    )
    expect(malformed.status).toBe(400)
    expect((await malformed.json()).error.code).toBe('MALFORMED_JSON')

    const invalid = await handler(
      new Request('http://127.0.0.1/api/v1/test', {
        method: 'POST',
        body: JSON.stringify({ value: 0, extra: true })
      }),
      routeContext
    )
    expect(invalid.status).toBe(422)
    expect((await invalid.json()).error.issues.length).toBeGreaterThan(0)

    const crossOrigin = await handler(
      new Request('http://127.0.0.1/api/v1/test', {
        method: 'POST',
        headers: { Origin: 'https://example.com' },
        body: JSON.stringify({ value: 1 })
      }),
      routeContext
    )
    expect(crossOrigin.status).toBe(403)

    const unavailable = withControlApi({}, () => {
      throw new ControlError(CONTROL_ERROR_CODE.UNAVAILABLE)
    })
    expect(
      (await unavailable(new Request('http://127.0.0.1/api/v1/test'), routeContext)).status
    ).toBe(503)
  })
})
