#!/usr/bin/env node

/**
 * Production entry point for Modbus Simulator.
 *
 * Usage:
 *   node cli.mjs [options]
 *   npx @ruixe/modbus-simulator [options]
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openBrowser } from './lib/open-browser.mjs'
import { HELP_TEXT, parseArgs } from './lib/parse-args.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  console.log(HELP_TEXT)
  process.exit(0)
}

// Apply CLI arguments as environment variables before spawning the server
if (args.port) process.env.PORT = String(args.port)
else if (!process.env.PORT) process.env.PORT = '5000'
if (args.tcpPort) process.env.MODBUS_TCP_PORT = String(args.tcpPort)
if (args.serialPort) process.env.MODBUS_RTU_SERIAL_PATH = args.serialPort
if (args.slaveId) process.env.MODBUS_SLAVE_ID = String(args.slaveId)

// Explicitly copy env to avoid any proxy/serialization issues with process.env
const env = { ...process.env }

// Resolve the Next.js CLI via Node.js module resolution to handle npm's
// dependency hoisting correctly.
let nextPath
let proc

try {
  const nextUrl = import.meta.resolve('next/dist/bin/next')
  nextPath = fileURLToPath(nextUrl)
} catch {
  console.error('Error: Could not find Next.js CLI (next/dist/bin/next).')
  console.error('Make sure next is installed as a dependency.')
  process.exit(1)
}

proc = spawn(process.execPath, [nextPath, 'start'], {
  stdio: 'inherit',
  cwd: dirname(__dirname),
  env
})

if (args.open) {
  openBrowser(`http://localhost:${process.env.PORT}`)
}

// Forward termination signals to child process for graceful shutdown
process.on('SIGTERM', () => {
  proc.kill('SIGTERM')
})

process.on('SIGINT', () => {
  proc.kill('SIGINT')
})

proc.on('error', (err) => {
  console.error(`Failed to start Next.js server: ${err.message}`)
  process.exit(1)
})

// Exit when child exits (naturally handles both normal and signal-based termination)
proc.on('exit', (code) => {
  process.exit(code ?? 0)
})
