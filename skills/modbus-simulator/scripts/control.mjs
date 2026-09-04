#!/usr/bin/env node

/** Process exit codes by failure category. */
const EXIT = { SUCCESS: 0, USAGE: 2, NETWORK: 3, API: 4, TIMEOUT: 5 }
/** Modbus table names exposed by the public read/write API. */
const TABLES = new Set(['coils', 'discrete-inputs', 'holding-registers', 'input-registers'])

/** Thrown for invalid CLI arguments; maps to EXIT.USAGE. */
class UsageError extends Error {}
/** Thrown when a request fails before a response is received. */
class NetworkError extends Error {}
/** Thrown for non-2xx or malformed API responses; carries the API error code. */
class ApiError extends Error {
  /**
   * @param {string} code - Machine-readable error code from the API error envelope.
   * @param {string} message - Human-readable failure description.
   */
  constructor(code, message) {
    super(message)
    this.code = code
  }
}
/** Thrown when `wait` exhausts its deadline before the simulator reports ready. */
class TimeoutError extends Error {}

/**
 * Parses raw argv into a command name and an options map.
 * @param {string[]} argv - Arguments following the script path.
 * @returns {{ command: string, options: Record<string, string | boolean> }} The parsed invocation.
 */
function parse(argv) {
  const command = argv.shift()
  if (!command) throw new UsageError('A command is required.')
  const options = {}
  while (argv.length) {
    const key = argv.shift()
    if (!key?.startsWith('--')) throw new UsageError(`Unexpected argument: ${key}`)
    if (key === '--clear-logs') {
      options.clearLogs = true
      continue
    }
    const value = argv.shift()
    if (value === undefined || value.startsWith('--'))
      throw new UsageError(`${key} requires a value.`)
    options[key.slice(2)] = value
  }
  return { command, options }
}

/**
 * Reads an integer CLI option with optional fallback and inclusive bounds.
 * @param {Record<string, string | boolean>} options - Parsed CLI options.
 * @param {string} name - Option key without the leading `--`.
 * @param {number} [fallback] - Used when the option is absent.
 * @param {number} [min] - Inclusive lower bound.
 * @param {number} [max] - Inclusive upper bound.
 * @returns {number} The validated integer value.
 */
function integer(options, name, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const raw = options[name]
  if (raw === undefined && fallback !== undefined) return fallback
  if (raw === undefined || !/^\d+$/.test(raw)) throw new UsageError(`--${name} must be an integer.`)
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new UsageError(`--${name} is out of range.`)
  return value
}

/**
 * Validates the `--table` option against the public tables.
 * @param {Record<string, string | boolean>} options - Parsed CLI options.
 * @returns {string} A public Modbus table name.
 */
function table(options) {
  if (!TABLES.has(options.table)) throw new UsageError('--table must name a public Modbus table.')
  return options.table
}

/**
 * Performs a JSON request against the simulator API and unwraps the success envelope.
 * @param {string} baseUrl - Simulator API root URL.
 * @param {string} path - API path, optionally including a query string.
 * @param {object} [init] - Extra fetch options (method, body).
 * @returns {Promise<unknown>} The `data` member of the success envelope.
 */
async function request(baseUrl, path, init = {}) {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('content-type', 'application/json')
  if (process.env.MODBUS_API_TOKEN)
    headers.set('authorization', `Bearer ${process.env.MODBUS_API_TOKEN}`)
  let response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(3000)
    })
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : String(error))
  }
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new ApiError('MALFORMED_RESPONSE', `HTTP ${response.status} returned invalid JSON.`)
  }
  if (!response.ok)
    throw new ApiError(
      payload?.error?.code ?? 'API_ERROR',
      payload?.error?.message ?? `HTTP ${response.status}`
    )
  if (!payload || typeof payload !== 'object' || !('data' in payload))
    throw new ApiError('MALFORMED_RESPONSE', 'Missing success envelope.')
  return payload.data
}

/**
 * Polls `/api/v1/health` until ready or the `--timeout` deadline elapses.
 * @param {string} baseUrl - Simulator API root URL.
 * @param {Record<string, string | boolean>} options - Parsed CLI options.
 * @returns {Promise<unknown>} The final health payload.
 */
async function runWait(baseUrl, options) {
  const deadline = Date.now() + integer(options, 'timeout', 30, 1, 3600) * 1000
  let last = 'Simulator not ready.'
  while (Date.now() < deadline) {
    try {
      const health = await request(baseUrl, '/api/v1/health')
      if (health.ready) return health
      last = JSON.stringify(health.transports)
    } catch (error) {
      if (error instanceof ApiError) throw error
      last = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new TimeoutError(last)
}

/**
 * Returns the current health snapshot.
 * @param {string} baseUrl - Simulator API root URL.
 * @returns {Promise<unknown>} The health payload.
 */
function runHealth(baseUrl) {
  return request(baseUrl, '/api/v1/health')
}

/**
 * Resets all or selected tables, optionally clearing the log buffer.
 * @param {string} baseUrl - Simulator API root URL.
 * @param {Record<string, string | boolean>} options - Parsed CLI options.
 * @returns {Promise<unknown>} The reset payload.
 */
function runReset(baseUrl, options) {
  const tables = options.tables ? options.tables.split(',') : undefined
  if (tables?.some((value) => !TABLES.has(value)))
    throw new UsageError('--tables contains an unknown table.')
  return request(baseUrl, '/api/v1/state/reset', {
    method: 'POST',
    body: JSON.stringify({
      ...(tables ? { tables } : {}),
      ...(options.clearLogs ? { clearLogs: true } : {})
    })
  })
}

/**
 * Reads a contiguous range from one public table.
 * @param {string} baseUrl - Simulator API root URL.
 * @param {Record<string, string | boolean>} options - Parsed CLI options.
 * @returns {Promise<unknown>} The register payload.
 */
function runRead(baseUrl, options) {
  const selected = table(options)
  const start = integer(options, 'start', undefined)
  const count = integer(options, 'count', undefined, 1, 1000)
  return request(baseUrl, `/api/v1/registers/${selected}?start=${start}&count=${count}`)
}

/**
 * Writes raw 16-bit values to one public table.
 * @param {string} baseUrl - Simulator API root URL.
 * @param {Record<string, string | boolean>} options - Parsed CLI options.
 * @returns {Promise<unknown>} The write payload.
 */
function runWrite(baseUrl, options) {
  const selected = table(options)
  const start = integer(options, 'start', undefined)
  let values
  try {
    values = JSON.parse(options.values)
  } catch {
    throw new UsageError('--values must be a JSON array.')
  }
  if (!Array.isArray(values)) throw new UsageError('--values must be a JSON array.')
  return request(baseUrl, `/api/v1/registers/${selected}`, {
    method: 'PUT',
    body: JSON.stringify({ start, values })
  })
}

/**
 * Writes byte- or typed-encoded values to one public table.
 * @param {string} baseUrl - Simulator API root URL.
 * @param {Record<string, string | boolean>} options - Parsed CLI options.
 * @returns {Promise<unknown>} The encoded-write payload.
 */
function runWriteEncoded(baseUrl, options) {
  const selected = table(options)
  const address = integer(options, 'address', undefined)
  const body = options.bytes
    ? { address, bytes: options.bytes }
    : { address, dataType: options['data-type'], value: Number(options.value) }
  if (
    !options.bytes &&
    (!options['data-type'] || options.value === undefined || !Number.isFinite(body.value))
  ) {
    throw new UsageError('write-encoded requires --bytes or --data-type with --value.')
  }
  return request(baseUrl, `/api/v1/registers/${selected}/encoded`, {
    method: 'PUT',
    body: JSON.stringify(body)
  })
}

/**
 * Applies a partial configuration patch.
 * @param {string} baseUrl - Simulator API root URL.
 * @param {Record<string, string | boolean>} options - Parsed CLI options.
 * @returns {Promise<unknown>} The config payload.
 */
function runConfig(baseUrl, options) {
  let body
  try {
    body = JSON.parse(options.json)
  } catch {
    throw new UsageError('--json must contain a JSON object.')
  }
  return request(baseUrl, '/api/v1/config', { method: 'PATCH', body: JSON.stringify(body) })
}

/**
 * Reads log entries with optional filters.
 * @param {string} baseUrl - Simulator API root URL.
 * @param {Record<string, string | boolean>} options - Parsed CLI options.
 * @returns {Promise<unknown>} The log payload.
 */
function runLogs(baseUrl, options) {
  const query = new URLSearchParams()
  for (const [option, parameter] of [
    ['after-id', 'afterId'],
    ['limit', 'limit'],
    ['type', 'type'],
    ['source', 'source']
  ]) {
    if (options[option] !== undefined) query.set(parameter, options[option])
  }
  const path = '/api/v1/logs' + (query.size ? '?' + query.toString() : '')
  return request(baseUrl, path)
}

/** Dispatch table from command name to handler; handlers receive the base URL and CLI options. */
const COMMANDS = {
  wait: runWait,
  health: runHealth,
  reset: runReset,
  read: runRead,
  write: runWrite,
  'write-encoded': runWriteEncoded,
  config: runConfig,
  logs: runLogs
}

/**
 * Resolves the base URL and dispatches to the command handler.
 * @param {string} command - Command name, the first CLI argument.
 * @param {Record<string, string | boolean>} options - Parsed CLI options.
 * @returns {Promise<unknown>} The command payload, printed as JSON by the entrypoint.
 */
async function run(command, options) {
  const baseUrl = (
    options['base-url'] ??
    process.env.MODBUS_SIMULATOR_URL ??
    'http://127.0.0.1:15000'
  ).replace(/\/$/, '')
  if (!Object.hasOwn(COMMANDS, command)) throw new UsageError(`Unknown command: ${command}`)
  return COMMANDS[command](baseUrl, options)
}

/** One-line usage text printed under usage-error messages. */
const usage =
  'Usage: control.mjs <wait|health|reset|read|write|write-encoded|config|logs> [options]'

try {
  const { command, options } = parse(process.argv.slice(2))
  console.log(JSON.stringify(await run(command, options)))
  process.exitCode = EXIT.SUCCESS
} catch (error) {
  if (error instanceof UsageError) {
    console.error(`${error.message}\n${usage}`)
    process.exitCode = EXIT.USAGE
  } else if (error instanceof NetworkError) {
    console.error(JSON.stringify({ code: 'NETWORK_ERROR', message: error.message }))
    process.exitCode = EXIT.NETWORK
  } else if (error instanceof ApiError) {
    console.error(JSON.stringify({ code: error.code, message: error.message }))
    process.exitCode = EXIT.API
  } else if (error instanceof TimeoutError) {
    console.error(JSON.stringify({ code: 'READINESS_TIMEOUT', message: error.message }))
    process.exitCode = EXIT.TIMEOUT
  } else {
    console.error(
      JSON.stringify({
        code: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : String(error)
      })
    )
    process.exitCode = EXIT.API
  }
}
