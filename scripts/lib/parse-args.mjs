import { parseArgs as nodeParseArgs } from 'node:util'

export class UsageError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UsageError'
  }
}

const OPTIONS = {
  port: { type: 'string', short: 'p' },
  host: { type: 'string' },
  'tcp-port': { type: 'string', short: 't' },
  'tcp-host': { type: 'string' },
  'serial-port': { type: 'string', short: 's' },
  'slave-id': { type: 'string', short: 'i' },
  'api-token-file': { type: 'string' },
  'ready-output': { type: 'string' },
  'ready-timeout': { type: 'string' },
  'strict-ready': { type: 'boolean' },
  open: { type: 'boolean', short: 'o' },
  version: { type: 'boolean', short: 'v' },
  help: { type: 'boolean', short: 'h' }
}

function integerOption(name, value, fallback, min, max) {
  if (value === undefined) return fallback
  if (!/^\d+$/.test(value))
    throw new UsageError(`--${name} must be an integer from ${min} to ${max}.`)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new UsageError(`--${name} must be an integer from ${min} to ${max}.`)
  }
  return parsed
}

function hostOption(name, value, fallback) {
  const host = value ?? fallback
  if (!host || host.length > 255 || !/^[a-zA-Z0-9.:[\]-]+$/.test(host) || host.includes('://')) {
    throw new UsageError(`--${name} must be a bare hostname or IP address.`)
  }
  return host.replace(/^\[|\]$/g, '')
}

export function parseArgs(argv) {
  let values
  try {
    ;({ values } = nodeParseArgs({
      args: argv,
      options: OPTIONS,
      strict: true,
      allowPositionals: false
    }))
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error))
  }

  const readyOutput = values['ready-output'] ?? 'text'
  if (readyOutput !== 'text' && readyOutput !== 'json') {
    throw new UsageError('--ready-output must be either text or json.')
  }

  return {
    port: integerOption('port', values.port ?? process.env.PORT, 5000, 1, 65535),
    host: hostOption('host', values.host ?? process.env.MODBUS_HTTP_HOST, '127.0.0.1'),
    tcpPort: integerOption(
      'tcp-port',
      values['tcp-port'] ?? process.env.MODBUS_TCP_PORT,
      502,
      1,
      65535
    ),
    tcpHost: hostOption('tcp-host', values['tcp-host'] ?? process.env.MODBUS_TCP_HOST, '127.0.0.1'),
    serialPort: values['serial-port'] ?? process.env.MODBUS_RTU_SERIAL_PATH ?? null,
    slaveId: integerOption(
      'slave-id',
      values['slave-id'] ?? process.env.MODBUS_SLAVE_ID,
      1,
      1,
      247
    ),
    apiTokenFile: values['api-token-file'] ?? null,
    readyOutput,
    readyTimeout: integerOption('ready-timeout', values['ready-timeout'], 30, 1, 3600),
    strictReady: values['strict-ready'] ?? false,
    open: values.open ?? false,
    version: values.version ?? false,
    help: values.help ?? false
  }
}

export const HELP_TEXT = `
Usage: npx @ruixe/modbus-simulator [options]

Options:
  -p, --port <number>           HTTP port (default: 5000)
      --host <host>             HTTP host (default: 127.0.0.1)
  -t, --tcp-port <number>       Modbus TCP port (default: 502)
      --tcp-host <host>         Modbus TCP host (default: 127.0.0.1)
  -s, --serial-port <path>      Modbus RTU serial port
  -i, --slave-id <number>       Device address (default: 1, range: 1-247)
      --api-token-file <path>   Read the control API Token from a file
      --ready-output <format>   text or json (default: text)
      --ready-timeout <seconds> Readiness timeout (default: 30)
      --strict-ready            Exit and clean up if readiness fails
  -o, --open                    Open the Dashboard after readiness
  -v, --version                 Print the package version
  -h, --help                    Show this help

Environment:
  MODBUS_API_TOKEN              Optional control API Bearer Token

Example:
  npx --yes @ruixe/modbus-simulator@latest --host 127.0.0.1 --port 15000 --tcp-host 127.0.0.1 --tcp-port 15020 --ready-output json --ready-timeout 30 --strict-ready
`.trim()
