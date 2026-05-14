#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

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
Usage: pnpm run dev -- [options]

Options:
  -p, --port <number>        HTTP server port (default: 5000)
  -t, --tcp-port <number>    Modbus TCP listening port (default: 502)
  -s, --serial-port <path>   Modbus RTU serial port (e.g., COM1, /dev/ttyUSB0)
  -h, --help                 Show this help message

Examples:
  pnpm run dev
  pnpm run dev -- -p 8080 -t 5020 -s COM3
  pnpm run dev -- --port=8080 --tcp-port=5020
`.trim()

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

const nextBin = join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next')

const proc = spawn(process.execPath, [nextBin, 'dev'], {
  stdio: 'inherit',
  cwd: projectRoot,
  env: process.env
})

proc.on('exit', (code) => {
  process.exit(code ?? 0)
})
