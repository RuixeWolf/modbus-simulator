#!/usr/bin/env node

/**
 * Publish script for NPM.
 *
 * 1. Runs `next build` to generate standalone output.
 * 2. Prepares a clean publish directory with only necessary files.
 * 3. Generates a production-ready package.json (no devDependencies).
 * 4. Publishes to NPM with --access=public.
 *
 * Usage:
 *   node scripts/publish.mjs           # Build and publish
 *   node scripts/publish.mjs --dry-run # Build and verify, but do not publish
 */
import { execSync, spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from './lib/fs-helpers.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(__dirname)

const isDryRun = process.argv.includes('--dry-run')

const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'))
const standaloneDir = join(projectRoot, '.next', 'standalone')

// ---------------------------------------------------------------------------
// Step 1: Build
// ---------------------------------------------------------------------------

console.log(`Building ${pkg.name} v${pkg.version} for NPM publish...\n`)

try {
  execSync('npx next build', { cwd: projectRoot, stdio: 'inherit' })
} catch {
  console.error('\nBuild failed. See output above for details.')
  process.exit(1)
}

if (!existsSync(standaloneDir)) {
  console.error(`\nStandalone output directory not found: ${standaloneDir}`)
  console.error('Make sure next.config.ts has output: "standalone" set.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Step 2: Prepare publish directory
// ---------------------------------------------------------------------------

const publishDir = mkdtempSync(join(tmpdir(), `${pkg.name.replace('/', '-')}-publish-`))

console.log(`\nPreparing publish directory: ${publishDir}\n`)

// Copy cli.mjs and lib helpers
const scriptsSource = join(projectRoot, 'scripts')
const scriptsTarget = join(publishDir, 'scripts')
mkdirSync(scriptsTarget, { recursive: true })

// cli.mjs
const cliSource = join(scriptsSource, 'cli.mjs')
const cliTarget = join(scriptsTarget, 'cli.mjs')
if (!existsSync(cliSource)) {
  console.error(`CLI entry point not found: ${cliSource}`)
  process.exit(1)
}
copyFileSync(cliSource, cliTarget)

// lib helpers
const libSource = join(scriptsSource, 'lib')
const libTarget = join(scriptsTarget, 'lib')
if (existsSync(libSource)) {
  mkdirSync(libTarget, { recursive: true })
  cpSync(libSource, libTarget, { recursive: true, force: true })
}

// Copy server.js
const serverSource = join(standaloneDir, 'server.js')
const serverTarget = join(publishDir, '.next', 'standalone', 'server.js')
if (!existsSync(serverSource)) {
  console.error(`Server entry point not found: ${serverSource}`)
  process.exit(1)
}
mkdirSync(dirname(serverTarget), { recursive: true })
copyFileSync(serverSource, serverTarget)

// Copy public assets (from standalone output which already has them)
const publicSource = join(standaloneDir, 'public')
const publicTarget = join(publishDir, '.next', 'standalone', 'public')
if (existsSync(publicSource)) {
  mkdirSync(publicTarget, { recursive: true })
  cpSync(publicSource, publicTarget, { recursive: true, force: true })
}

// Copy static assets (from standalone output which already has them)
const staticSource = join(standaloneDir, '.next', 'static')
const staticTarget = join(publishDir, '.next', 'standalone', '.next', 'static')
if (existsSync(staticSource)) {
  mkdirSync(staticTarget, { recursive: true })
  cpSync(staticSource, staticTarget, { recursive: true, force: true })
}

// ---------------------------------------------------------------------------
// Step 3: Generate clean package.json for publishing
// ---------------------------------------------------------------------------

const publishPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  bin: pkg.bin,
  files: ['scripts', '.next', 'public'],
  dependencies: pkg.dependencies,
  engines: pkg.engines,
  publishConfig: pkg.publishConfig,
  keywords: pkg.keywords,
  author: pkg.author,
  license: pkg.license,
  repository: pkg.repository,
  bugs: pkg.bugs,
  homepage: pkg.homepage
}

const publishPkgPath = join(publishDir, 'package.json')
writeFileSync(publishPkgPath, `${JSON.stringify(publishPkg, null, 2)}\n`)

// ---------------------------------------------------------------------------
// Step 4: Verify and publish
// ---------------------------------------------------------------------------

console.log('\nPublish directory ready.')
console.log(`  Location: ${publishDir}`)
console.log(`  Package:  ${pkg.name}@${pkg.version}`)
console.log(`  Files:    scripts/, .next/standalone/, public/`)
console.log(`  Deps:     ${Object.keys(pkg.dependencies).length} production dependencies`)

if (isDryRun) {
  console.log('\n🔍 Dry run mode — skipping npm publish.')
  console.log('   To publish for real, run without --dry-run.')
  console.log(`\n   You can inspect the package with:`)
  console.log(`   cd ${publishDir}`)
  console.log(`   npm pack --dry-run`)
  process.exit(0)
}

console.log('\n📦 Publishing to NPM...\n')

const npmPublish = spawn('npm', ['publish', '--access=public'], {
  stdio: 'inherit',
  cwd: publishDir,
  shell: true
})

npmPublish.on('exit', (code) => {
  if (code === 0) {
    console.log(`\n✅ Published ${pkg.name}@${pkg.version} successfully!`)
    console.log(`\nUsers can now run:`)
    console.log(`  npx ${pkg.name} --help`)
  } else {
    console.error(`\n❌ Publish failed with exit code ${code}.`)
  }

  // Clean up temp directory
  try {
    rmSync(publishDir, { recursive: true, force: true })
  } catch {
    // ignore cleanup errors
  }

  process.exit(code ?? 0)
})
