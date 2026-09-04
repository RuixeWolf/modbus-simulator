import { describe, expect, it } from 'vitest'
import { parseArgs, UsageError } from './parse-args.mjs'

describe('strict CLI argument parsing', () => {
  it('forwards valid automation options', () => {
    expect(
      parseArgs([
        '--host',
        '0.0.0.0',
        '--port',
        '15000',
        '--tcp-host',
        '127.0.0.1',
        '--tcp-port',
        '15020',
        '--api-token-file',
        'token.txt',
        '--ready-output',
        'json',
        '--ready-timeout',
        '12',
        '--strict-ready'
      ])
    ).toMatchObject({
      host: '0.0.0.0',
      port: 15000,
      tcpHost: '127.0.0.1',
      tcpPort: 15020,
      apiTokenFile: 'token.txt',
      readyOutput: 'json',
      readyTimeout: 12,
      strictReady: true
    })
  })

  it.each([
    ['--unknown'],
    ['--port', '0'],
    ['--tcp-port', '65536'],
    ['--slave-id', '1.5'],
    ['--ready-timeout', '0'],
    ['--ready-output', 'xml'],
    ['--host', 'https://example.com']
  ])('rejects invalid input before launch: %s', (...argv) => {
    expect(() => parseArgs(argv)).toThrow(UsageError)
  })
})
