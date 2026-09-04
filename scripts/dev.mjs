#!/usr/bin/env node
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from './lib/fs-helpers.mjs'
import { launchSimulator } from './lib/launch.mjs'
import { HELP_TEXT, parseArgs, UsageError } from './lib/parse-args.mjs'

const scriptsDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(scriptsDirectory)
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 1) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    if (process.env[key] === undefined) process.env[key] = value
  }
}

try {
  loadEnvFile(join(projectRoot, '.env.local'))
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(HELP_TEXT)
    process.exit(0)
  }
  if (args.version) {
    console.log(packageJson.version)
    process.exit(0)
  }
  const nextPath = join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next')
  process.exitCode = await launchSimulator({
    args,
    nextPath,
    nextCommand: 'dev',
    projectRoot
  })
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
  if (error instanceof UsageError) console.error('\n' + HELP_TEXT)
  process.exitCode = error instanceof UsageError ? 2 : 1
}
