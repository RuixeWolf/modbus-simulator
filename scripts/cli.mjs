#!/usr/bin/env node

/**
 * Production entry point for Modbus Simulator.
 *
 * Supports three execution contexts:
 * 1. Standalone distribution: server.js in same directory
 * 2. NPM package (standalone): .next/standalone/server.js
 * 3. NPM package (regular build): next start from package root
 *
 * Usage:
 *   node cli.mjs [options]
 *   npx @ruixe/modbus-simulator [options]
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

// Explicitly copy env to avoid any proxy/serialization issues with process.env
const env = { ...process.env }

// Determine how to start the server based on available files
const serverStrategy = (() => {
  // Option 1: Standalone distribution (server.js in same dir)
  const standalonePath = join(__dirname, 'server.js')
  if (existsSync(standalonePath)) {
    return { type: 'server.js', path: standalonePath, cwd: dirname(standalonePath) }
  }

  // Option 2: NPM package with standalone build
  const npmStandalonePath = join(__dirname, '..', '.next', 'standalone', 'server.js')
  if (existsSync(npmStandalonePath)) {
    return { type: 'server.js', path: npmStandalonePath, cwd: dirname(npmStandalonePath) }
  }

  // Option 3: NPM package with regular build — use next start
  // Use import.meta.resolve to find next via Node.js module resolution,
  // which handles npm's dependency hoisting correctly.
  try {
    const nextUrl = import.meta.resolve('next/dist/bin/next')
    const nextPath = fileURLToPath(nextUrl)
    return { type: 'next', path: nextPath, cwd: dirname(__dirname) }
  } catch {
    // next not found
  }

  console.error('Error: Could not find a way to start the server.')
  console.error('Searched:')
  console.error(`  - ${standalonePath}`)
  console.error(`  - ${npmStandalonePath}`)
  console.error(`  - next (via Node.js module resolution)`)
  process.exit(1)
})()

let proc

if (serverStrategy.type === 'server.js') {
  proc = spawn(process.execPath, [serverStrategy.path], {
    stdio: 'inherit',
    cwd: serverStrategy.cwd,
    env
  })
} else {
  proc = spawn(process.execPath, [serverStrategy.path, 'start'], {
    stdio: 'inherit',
    cwd: serverStrategy.cwd,
    env
  })
}

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
