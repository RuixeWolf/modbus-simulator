import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('CLI validation', () => {
  it('prints package version without creating a service', () => {
    const result = spawnSync(process.execPath, ['scripts/cli.mjs', '--version'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    })
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it.each([
    ['--unknown'],
    ['--port', '0'],
    ['--ready-output', 'xml'],
    ['--host', '0.0.0.0', '--ready-timeout', '1', '--strict-ready']
  ])('returns exit code 2 before spawning for invalid or unsafe input', (...argv) => {
    const result = spawnSync(process.execPath, ['scripts/cli.mjs', ...argv], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, MODBUS_API_TOKEN: '' }
    })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('Error:')
    expect(result.stdout).not.toContain('ready - started server')
  })
})
