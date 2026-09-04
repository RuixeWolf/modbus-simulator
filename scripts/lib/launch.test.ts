import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { launchSimulator } from './launch.mjs'

interface LaunchArgs {
  port: number
  host: string
  tcpPort: number
  tcpHost: string
  serialPort: string | null
  slaveId: number
  apiTokenFile: string | null
  readyOutput: 'text' | 'json'
  readyTimeout: number
  strictReady: boolean
  open: boolean
  version: boolean
  help: boolean
}

const tempDirectories: string[] = []

function tempProject(source: string): { root: string; nextPath: string; pidPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'modbus-launch-test-'))
  tempDirectories.push(root)
  const nextPath = join(root, 'next-stub.mjs')
  const pidPath = join(root, 'child.pid')
  writeFileSync(nextPath, source)
  return { root, nextPath, pidPath }
}

function args(overrides: Partial<LaunchArgs> = {}): LaunchArgs {
  return {
    port: 21991,
    host: '127.0.0.1',
    tcpPort: 21992,
    tcpHost: '127.0.0.1',
    serialPort: null,
    slaveId: 1,
    apiTokenFile: null,
    readyOutput: 'json',
    readyTimeout: 2,
    strictReady: true,
    open: false,
    version: false,
    help: false,
    ...overrides
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('CLI launch readiness', () => {
  it('prints READY only after the health endpoint reports ready', async () => {
    const fixture = tempProject(`
      import { createServer } from 'node:http'
      const port = Number(process.argv[process.argv.indexOf('-p') + 1])
      let checks = 0
      const server = createServer((_request, response) => {
        checks++
        response.setHeader('content-type', 'application/json')
        response.end(JSON.stringify({
          data: {
            ready: checks > 1,
            packageVersion: '1.1.0',
            apiVersion: '1',
            instanceId: 'fixture-instance',
            transports: { tcp: { state: 'running', actualConfig: { host: '127.0.0.1', port: 21992 } } }
          }
        }))
        if (checks > 1) setTimeout(() => server.close(() => process.exit(0)), 100)
      })
      server.listen(port, '127.0.0.1')
    `)
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    expect(
      await launchSimulator({
        args: args(),
        nextPath: fixture.nextPath,
        nextCommand: 'fixture',
        projectRoot: fixture.root
      })
    ).toBe(0)
    expect(output).toHaveBeenCalledTimes(1)
    expect(output.mock.calls[0]?.[0]).toMatch(/^MODBUS_SIMULATOR_READY /)
  }, 10_000)

  it('times out, emits a secret-free ERROR record and terminates its owned child in strict mode', async () => {
    const fixture = tempProject(`
      import { writeFileSync } from 'node:fs'
      writeFileSync(process.env.TEST_PID_PATH, String(process.pid))
      setInterval(() => undefined, 1000)
    `)
    vi.stubEnv('MODBUS_API_TOKEN', 'never-print-this-token')
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(
      await launchSimulator({
        args: args({ readyTimeout: 1 }),
        nextPath: fixture.nextPath,
        nextCommand: 'fixture',
        projectRoot: fixture.root,
        extraEnv: { TEST_PID_PATH: fixture.pidPath }
      })
    ).toBe(1)
    expect(existsSync(fixture.pidPath)).toBe(true)
    const pid = Number(readFileSync(fixture.pidPath, 'utf8'))
    expect(() => process.kill(pid, 0)).toThrow()
    expect(errors.mock.calls.flat().join(' ')).toMatch(/^MODBUS_SIMULATOR_ERROR /)
    expect(errors.mock.calls.flat().join(' ')).not.toContain('never-print-this-token')
  }, 10_000)

  it('keeps degraded non-strict mode alive long enough for human diagnostics', async () => {
    const fixture = tempProject('setTimeout(() => process.exit(0), 1300)')
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(
      await launchSimulator({
        args: args({ readyOutput: 'text', readyTimeout: 1, strictReady: false }),
        nextPath: fixture.nextPath,
        nextCommand: 'fixture',
        projectRoot: fixture.root
      })
    ).toBe(0)
    expect(errors.mock.calls.flat().join(' ')).toContain('Modbus Simulator is degraded:')
  }, 10_000)
})
