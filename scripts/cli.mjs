#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchSimulator } from './lib/launch.mjs'
import { HELP_TEXT, parseArgs, UsageError } from './lib/parse-args.mjs'

const scriptsDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(scriptsDirectory)
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))

try {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(HELP_TEXT)
    process.exit(0)
  }
  if (args.version) {
    console.log(packageJson.version)
    process.exit(0)
  }
  let nextPath
  try {
    nextPath = fileURLToPath(import.meta.resolve('next/dist/bin/next'))
  } catch {
    throw new Error('Could not find the Next.js CLI.')
  }
  process.exitCode = await launchSimulator({ args, nextPath, nextCommand: 'start', projectRoot })
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
  if (error instanceof UsageError) console.error('\n' + HELP_TEXT)
  process.exitCode = error instanceof UsageError ? 2 : 1
}
