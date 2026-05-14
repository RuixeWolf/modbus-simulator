#!/usr/bin/env node

/**
 * Standalone production entry point for Modbus Simulator.
 *
 * This script is copied into .next/standalone/ during the build-standalone
 * step. Users can run the simulator directly with:
 *
 *   node start.mjs [options]
 *
 * No npm install is required because Next.js standalone output bundles the
 * necessary dependencies.
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Parse CLI arguments manually so the wrapper needs zero dependencies. */
function parseArgs(argv) {
  const args = { port: null, tcpPort: null, serialPort: null, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-p' || arg === '--port') {
      args.port = argv[++i] ?? null
    } else if (arg.startsWith('--port=')) {
      args.port = arg.slice(7) || null
    } else if (arg === '-t' || arg === '--tcp-port') {
      args.tcpPort = argv[++i] ?? null
    } else if (arg.startsWith('--tcp-port=')) {
      args.tcpPort = arg.slice(11) || null
    } else if (arg === '-s' || arg === '--serial-port') {
      args.serialPort = argv[++i] ?? null
    } else if (arg.startsWith('--serial-port=')) {
      args.serialPort = arg.slice(14) || null
    } else if (arg === '-h' || arg === '--help') {
      args.help = true
    }
  }
  return args
}

const HELP_TEXT = `
Usage: node start.mjs [options]

Options:
  -p, --port <number>        HTTP server port (default: 5000)
  -t, --tcp-port <number>    Modbus TCP listening port (default: 502)
  -s, --serial-port <path>   Modbus RTU serial port (e.g., COM1, /dev/ttyUSB0)
  -h, --help                 Show this help message

Examples:
  node start.mjs
  node start.mjs -p 8080 -t 5020 -s COM3
  node start.mjs --port=8080 --tcp-port=5020
`.trim()

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  console.log(HELP_TEXT)
  process.exit(0)
}

// Apply CLI arguments as environment variables before spawning the server
if (args.port) process.env.PORT = String(args.port)
if (args.tcpPort) process.env.MODBUS_TCP_PORT = String(args.tcpPort)
if (args.serialPort) process.env.MODBUS_RTU_SERIAL_PATH = args.serialPort

const serverPath = join(__dirname, 'server.js')

const proc = spawn(process.execPath, [serverPath], {
  stdio: 'inherit',
  cwd: __dirname,
  env: process.env
})

// Forward termination signals to child process for graceful shutdown
process.on('SIGTERM', () => {
  proc.kill('SIGTERM')
})

process.on('SIGINT', () => {
  proc.kill('SIGINT')
})

// Exit when child exits (naturally handles both normal and signal-based termination)
proc.on('exit', (code) => {
  process.exit(code ?? 0)
})
