#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HELP_TEXT, parseArgs } from './lib/parse-args.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(__dirname)

/** Known environment variable keys that the simulator uses. */
const KNOWN_ENV_KEYS = ['PORT', 'MODBUS_TCP_PORT', 'MODBUS_RTU_SERIAL_PATH']

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
    if (KNOWN_ENV_KEYS.includes(key) && process.env[key] === undefined) {
      process.env[key] = value
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

const nextBin = join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next')

const proc = spawn(process.execPath, [nextBin, 'dev'], {
  stdio: 'inherit',
  cwd: projectRoot,
  env: process.env
})

proc.on('exit', (code) => {
  process.exit(code ?? 0)
})
