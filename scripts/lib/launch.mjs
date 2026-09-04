import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { openBrowser } from './open-browser.mjs'
import { UsageError } from './parse-args.mjs'
import {
  isLoopbackHost,
  printReady,
  printReadyError,
  readyRecord,
  waitForHealth
} from './readiness.mjs'

function readTokenFile(path) {
  let token
  try {
    token = readFileSync(path, 'utf8').trim()
  } catch {
    throw new UsageError('--api-token-file could not be read.')
  }
  if (!token) throw new UsageError('--api-token-file must not be empty.')
  return token
}

async function stopOwnedChild(child) {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000))
  ])
  if (child.exitCode === null) child.kill('SIGKILL')
}

export async function launchSimulator({ args, nextPath, nextCommand, projectRoot, extraEnv = {} }) {
  const token = args.apiTokenFile
    ? readTokenFile(args.apiTokenFile)
    : process.env.MODBUS_API_TOKEN?.trim() || null
  if (!isLoopbackHost(args.host) && !token) {
    throw new UsageError('A non-loopback --host requires MODBUS_API_TOKEN or --api-token-file.')
  }

  const env = {
    ...process.env,
    ...extraEnv,
    PORT: String(args.port),
    MODBUS_HTTP_HOST: args.host,
    MODBUS_TCP_HOST: args.tcpHost,
    MODBUS_TCP_PORT: String(args.tcpPort),
    MODBUS_SLAVE_ID: String(args.slaveId),
    ...(args.serialPort ? { MODBUS_RTU_SERIAL_PATH: args.serialPort } : {}),
    ...(token ? { MODBUS_API_TOKEN: token } : {})
  }

  const child = spawn(
    process.execPath,
    [
      nextPath,
      nextCommand,
      ...(nextCommand === 'dev' ? ['--webpack', '--no-server-fast-refresh'] : []),
      '-H',
      args.host,
      '-p',
      String(args.port)
    ],
    { stdio: 'inherit', cwd: projectRoot, env }
  )
  const baseUrl = `http://${isLoopbackHost(args.host) ? args.host : '127.0.0.1'}:${args.port}`

  const forwardSignal = (signal) => {
    if (child.exitCode === null) child.kill(signal)
  }
  process.on('SIGTERM', () => forwardSignal('SIGTERM'))
  process.on('SIGINT', () => forwardSignal('SIGINT'))

  child.once('error', (error) => printReadyError(args.readyOutput, error))

  try {
    const health = await waitForHealth({ baseUrl, token, timeoutSeconds: args.readyTimeout, child })
    printReady(args.readyOutput, readyRecord(health, baseUrl))
  } catch (error) {
    printReadyError(args.readyOutput, error)
    if (args.strictReady) {
      await stopOwnedChild(child)
      return 1
    }
  }

  if (args.open) openBrowser(baseUrl)
  return await new Promise((resolve) => child.once('exit', (code) => resolve(code ?? 0)))
}
