#!/usr/bin/env node

/**
 * Standalone production entry point for Modbus Simulator.
 *
 * This script is copied into .next/standalone/ during the build-standalone
 * step. Users can run the simulator directly with:
 *
 *   node cli.mjs [options]
 *
 * No npm install is required because Next.js standalone output bundles the
 * necessary dependencies.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
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

// Support both standalone distribution (server.js in same dir)
// and npm-installed package (server.js in .next/standalone/)
const serverPath = (() => {
  const standalonePath = join(__dirname, 'server.js')
  if (existsSync(standalonePath)) {
    return standalonePath
  }
  const npmPath = join(__dirname, '..', '.next', 'standalone', 'server.js')
  if (existsSync(npmPath)) {
    return npmPath
  }
  console.error('Error: Could not find server.js')
  console.error('Searched:')
  console.error(`  - ${standalonePath}`)
  console.error(`  - ${npmPath}`)
  process.exit(1)
})()

const serverCwd = dirname(serverPath)

// Explicitly copy env to avoid any proxy/serialization issues with process.env
const env = { ...process.env }

const proc = spawn(process.execPath, [serverPath], {
  stdio: 'inherit',
  cwd: serverCwd,
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

// Exit when child exits (naturally handles both normal and signal-based termination)
proc.on('exit', (code) => {
  process.exit(code ?? 0)
})
