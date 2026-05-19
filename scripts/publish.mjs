#!/usr/bin/env node

/**
 * Publish script for NPM.
 *
 * 1. Runs `next build` to generate the production build.
 * 2. Prepares a clean publish directory with only necessary files.
 * 3. Fixes Next.js Turbopack external module symlinks in `.next/node_modules/`
 *    by replacing them with cross-platform stub modules.
 * 4. Generates a production-ready package.json (no devDependencies).
 * 5. Publishes to NPM with --access=public.
 *
 * Usage:
 *   node scripts/publish.mjs           # Build and publish
 *   node scripts/publish.mjs --dry-run # Build and verify, but do not publish
 */
import { execSync, spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync
} from './lib/fs-helpers.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(__dirname)

const isDryRun = process.argv.includes('--dry-run')

const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'))
const nextDir = join(projectRoot, '.next')
const standaloneDir = join(nextDir, 'standalone')

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

const cliSource = join(scriptsSource, 'cli.mjs')
const cliTarget = join(scriptsTarget, 'cli.mjs')
if (!existsSync(cliSource)) {
  console.error(`CLI entry point not found: ${cliSource}`)
  process.exit(1)
}
copyFileSync(cliSource, cliTarget)

const libSource = join(scriptsSource, 'lib')
const libTarget = join(scriptsTarget, 'lib')
if (existsSync(libSource)) {
  mkdirSync(libTarget, { recursive: true })
  cpSync(libSource, libTarget, { recursive: true, force: true })
}

// Copy .next/ (regular build output) excluding large/unneeded directories
const nextTarget = join(publishDir, '.next')
mkdirSync(nextTarget, { recursive: true })
copyDirExcept(nextDir, nextTarget, [
  'cache',
  'dev',
  'diagnostics',
  'standalone',
  'trace',
  'trace-build',
  'turbopack',
  'types'
])

// Fix Next.js Turbopack external module symlinks.
// Turbopack creates hashed symlinks in .next/node_modules/ pointing to external
// packages (serverExternalPackages). These symlinks use absolute paths from the
// build machine and break on users' machines. We replace them with stub modules
// that re-export the actual package via Node.js module resolution.
const nextNodeModules = join(nextTarget, 'node_modules')
if (existsSync(nextNodeModules)) {
  console.log('Fixing external module symlinks...')
  fixExternalModuleStubs(nextNodeModules)
}

// Copy public/ assets from project root
const publicSource = join(projectRoot, 'public')
const publicTarget = join(publishDir, 'public')
if (existsSync(publicSource)) {
  mkdirSync(publicTarget, { recursive: true })
  cpSync(publicSource, publicTarget, { recursive: true, force: true })
}

// Copy README.md
const readmeSource = join(projectRoot, 'README.md')
const readmeTarget = join(publishDir, 'README.md')
if (existsSync(readmeSource)) {
  copyFileSync(readmeSource, readmeTarget)
}

// ---------------------------------------------------------------------------
// Step 3: Generate clean package.json for publishing
// ---------------------------------------------------------------------------

const publishPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  bin: pkg.bin,
  files: ['scripts', '.next', 'public', 'README.md'],
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
console.log(`  Files:    scripts/, .next/ (regular build), public/`)
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively copy a directory, skipping entries whose basename is in the
 * `exclude` array.
 */
function copyDirExcept(src, dest, exclude) {
  mkdirSync(dest, { recursive: true })
  const items = readdirSync(src)

  for (const item of items) {
    if (exclude.includes(item)) continue

    const srcPath = join(src, item)
    const destPath = join(dest, item)
    const stats = lstatSync(srcPath)

    if (stats.isDirectory()) {
      copyDirExcept(srcPath, destPath, exclude)
    } else if (stats.isSymbolicLink()) {
      handleSymbolicLink(srcPath, destPath, exclude)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

/**
 * Handle copying a symbolic link, resolving it and copying the target.
 */
function handleSymbolicLink(srcPath, destPath, exclude) {
  const target = readlinkSync(srcPath)
  const targetPath = isAbsolute(target) ? target : join(dirname(srcPath), target)
  if (!existsSync(targetPath)) return

  const targetStats = lstatSync(targetPath)
  if (targetStats.isDirectory()) {
    copyDirExcept(targetPath, destPath, exclude)
  } else {
    copyFileSync(targetPath, destPath)
  }
}

/**
 * Replace Next.js Turbopack external module directories with cross-platform
 * stub modules. The bundled server code requires modules using hashed names
 * (e.g. 'serialport-c62565d3a24d4c05'). We create stub packages that re-export
 * the actual installed package, so npm install compiles native bindings for the
 * user's platform and the bundled code resolves them correctly.
 */
function fixExternalModuleStubs(nodeModulesDir) {
  const items = readdirSync(nodeModulesDir)

  for (const item of items) {
    const itemPath = join(nodeModulesDir, item)
    const stats = lstatSync(itemPath)

    if (!stats.isDirectory()) continue

    // Detect hashed external module names: package-name-{16-char-hex-hash}
    const hashMatch = item.match(/^(.+)-([0-9a-f]{16})$/)
    if (!hashMatch) continue

    const packageName = hashMatch[1]
    console.log(`  → ${item} → ${packageName}`)

    // Remove the copied directory (contains build-machine-specific files)
    rmSync(itemPath, { recursive: true, force: true })
    mkdirSync(itemPath, { recursive: true })

    // Create stub package
    writeFileSync(
      join(itemPath, 'package.json'),
      JSON.stringify({ name: item, version: '1.0.0', main: 'index.js' }, null, 2) + '\n'
    )
    writeFileSync(join(itemPath, 'index.js'), `module.exports = require('${packageName}')\n`)
  }
}
