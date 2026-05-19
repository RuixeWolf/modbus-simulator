#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from './lib/fs-helpers.mjs'
import { openBrowser } from './lib/open-browser.mjs'
import { HELP_TEXT, parseArgs } from './lib/parse-args.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(__dirname)

/** Load a simple key=value env file without overwriting existing env vars. */
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const content = readFileSync(filePath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (key === 'PORT' && process.env.PORT === undefined) {
      process.env.PORT = value
    } else if (key === 'MODBUS_TCP_PORT' && process.env.MODBUS_TCP_PORT === undefined) {
      process.env.MODBUS_TCP_PORT = value
    } else if (
      key === 'MODBUS_RTU_SERIAL_PATH' &&
      process.env.MODBUS_RTU_SERIAL_PATH === undefined
    ) {
      process.env.MODBUS_RTU_SERIAL_PATH = value
    }
  }
}

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  console.log(HELP_TEXT)
  process.exit(0)
}

// Load .env.local first so CLI args can override it
loadEnvFile(join(projectRoot, '.env.local'))

// Apply CLI arguments as environment variables
if (args.port) process.env.PORT = String(args.port)
else if (!process.env.PORT) process.env.PORT = '5000'
if (args.tcpPort) process.env.MODBUS_TCP_PORT = String(args.tcpPort)
if (args.serialPort) process.env.MODBUS_RTU_SERIAL_PATH = args.serialPort
if (args.slaveId) process.env.MODBUS_SLAVE_ID = String(args.slaveId)

const nextBin = join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next')

// Explicitly copy env to avoid any proxy/serialization issues with process.env
// Force Webpack instead of Turbopack — Next.js 16's Turbopack has a broken
// internal font module (@vercel/turbopack-next) on this platform.
const env = { ...process.env, NEXT_PRIVATE_LOCAL_WEBPACK: 'true' }

const proc = spawn(process.execPath, [nextBin, 'dev'], {
  stdio: 'inherit',
  cwd: projectRoot,
  env
})

if (args.open) {
  openBrowser(`http://localhost:${process.env.PORT || '5000'}`)
}

proc.on('exit', (code) => {
  process.exit(code ?? 0)
})
