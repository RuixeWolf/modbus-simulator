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
import { HELP_TEXT, parseArgs } from './lib/parse-args.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
