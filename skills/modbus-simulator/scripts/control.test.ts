import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const script = 'skills/modbus-simulator/scripts/control.mjs'
let baseUrl = ''
let mode: 'ready' | 'error' | 'waiting' = 'ready'
let authorization: string | undefined
const server = createServer((request, response) => {
  authorization = request.headers.authorization
  response.setHeader('content-type', 'application/json')
  if (mode === 'error') {
    response.statusCode = 422
    response.end(
      JSON.stringify({
        error: { code: 'VALIDATION_ERROR', message: 'Bad fixture.' },
        meta: { apiVersion: '1', instanceId: 'id' }
      })
    )
    return
  }
  response.end(
    JSON.stringify({
      data: { ready: mode === 'ready', transports: {} },
      meta: { apiVersion: '1', instanceId: 'id' }
    })
  )
})

function execute(args: string[], env: Partial<NodeJS.ProcessEnv> = {}) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(
      process.execPath,
      [script, ...args],
      { cwd: process.cwd(), env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        resolve({ code: typeof error?.code === 'number' ? error.code : 0, stdout, stderr })
      }
    )
  })
}

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not bind.')
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
})

describe('control helper', () => {
  it('prints JSON, sends optional Bearer auth and exits 0', async () => {
    mode = 'ready'
    const result = await execute(['health', '--base-url', baseUrl], {
      MODBUS_API_TOKEN: 'helper-secret'
    })
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ ready: true })
    expect(authorization).toBe('Bearer helper-secret')
  })

  it('uses documented exit codes for usage, network, API and timeout failures', async () => {
    expect((await execute([])).code).toBe(2)
    expect((await execute(['health', '--base-url', 'http://127.0.0.1:1'])).code).toBe(3)
    mode = 'error'
    expect((await execute(['health', '--base-url', baseUrl])).code).toBe(4)
    mode = 'waiting'
    expect((await execute(['wait', '--base-url', baseUrl, '--timeout', '1'])).code).toBe(5)
  })
})
