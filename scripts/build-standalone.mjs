#!/usr/bin/env node

/**
 * Build script that produces a standalone distributable output.
 *
 * 1. Runs `next build` with standalone output enabled.
 * 2. Copies `scripts/cli.mjs` into `.next/standalone/` as the user entry point.
 * 3. Copies public and static assets.
 * 4. Fixes PNPM symlink structures in `.next/standalone/node_modules` so the
 *    output works without reinstalling dependencies.
 * 5. Copies the fixed standalone output to `dist/`.
 */
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
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
  unlinkSync,
  writeFileSync
} from './lib/fs-helpers.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(__dirname)
const standaloneDir = join(projectRoot, '.next', 'standalone')
const startSource = join(projectRoot, 'scripts', 'cli.mjs')
const startTarget = join(standaloneDir, 'cli.mjs')

const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'))
const distName = `${pkg.name}_${pkg.version}`
const distDir = join(projectRoot, 'dist', distName)

console.log('Building Next.js standalone output...\n')

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

if (!existsSync(startSource)) {
  console.error(`\nStart script not found: ${startSource}`)
  process.exit(1)
}

copyFileSync(startSource, startTarget)

// Copy scripts/lib helpers that cli.mjs depends on
const libSource = join(projectRoot, 'scripts', 'lib')
const libTarget = join(standaloneDir, 'lib')
if (existsSync(libSource)) {
  mkdirSync(libTarget, { recursive: true })
  cpSync(libSource, libTarget, { recursive: true, force: true })
}

// Copy public assets if they exist
const publicSource = join(projectRoot, 'public')
const publicTarget = join(standaloneDir, 'public')
if (existsSync(publicSource)) {
  mkdirSync(publicTarget, { recursive: true })
  cpSync(publicSource, publicTarget, { recursive: true, force: true })
}

// Copy static assets if they exist
const staticSource = join(projectRoot, '.next', 'static')
const staticTarget = join(standaloneDir, '.next', 'static')
if (existsSync(staticSource)) {
  mkdirSync(staticTarget, { recursive: true })
  cpSync(staticSource, staticTarget, { recursive: true, force: true })
}

// Fix PNPM symlinks so the output works without reinstalling dependencies
const nodeModulesDir = join(standaloneDir, 'node_modules')
if (existsSync(nodeModulesDir)) {
  console.log('\nFixing PNPM symlinks in standalone/node_modules...')
  fixPnpmSymlinks(nodeModulesDir)
}

// Strip devDependencies and scripts from the standalone package.json
const standalonePkgPath = join(standaloneDir, 'package.json')
if (existsSync(standalonePkgPath)) {
  const standalonePkg = JSON.parse(readFileSync(standalonePkgPath, 'utf-8'))
  delete standalonePkg.devDependencies
  delete standalonePkg.scripts
  writeFileSync(standalonePkgPath, `${JSON.stringify(standalonePkg, null, 2)}\n`)
}

// Copy standalone output to dist directory
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true })
}
mkdirSync(distDir, { recursive: true })
cpSync(standaloneDir, distDir, { recursive: true, force: true })

console.log('\n✅ Standalone build complete!\n')
console.log(`Output directory: ${distDir}\n`)
console.log('To run the simulator:')
console.log(`  cd ${distDir}`)
console.log('  node cli.mjs [options]\n')
console.log('Options:')
console.log('  -p, --port {number}        HTTP server port (default: 5000)')
console.log('  -t, --tcp-port {number}    Modbus TCP listening port (default: 502)')
console.log('  -s, --serial-port {path}   Modbus RTU serial port (e.g., COM1, /dev/ttyUSB0)')
console.log('  -i, --slave-id {number}    Modbus device slave ID (default: 1, range: 1-247)')
console.log('  -o, --open                 Open browser automatically after startup')
console.log('  -h, --help                 Show help message\n')

// ---------------------------------------------------------------------------
// PNPM symlink fixing helpers (adapted from after-build.mjs)
// ---------------------------------------------------------------------------

/**
 * Remove all symlinks from the top-level node_modules directory.
 */
function removeTopLevelSymlinks(nodeModulesDir) {
  const items = readdirSync(nodeModulesDir)
  for (const item of items) {
    if (item === '.pnpm') continue
    const itemPath = join(nodeModulesDir, item)
    const stats = lstatSync(itemPath)
    if (stats.isSymbolicLink()) {
      unlinkSync(itemPath)
    }
  }
}

/**
 * Hoist a scoped package directory (e.g. @next/env) into the top-level node_modules.
 */
function hoistScopedPackage(srcPath, destPath) {
  if (!existsSync(destPath)) {
    mkdirSync(destPath, { recursive: true })
  }
  const scopedItems = readdirSync(srcPath)
  for (const scopedItem of scopedItems) {
    const scopedSrc = join(srcPath, scopedItem)
    const scopedDest = join(destPath, scopedItem)
    if (!existsSync(scopedDest)) {
      copyDirectory(scopedSrc, scopedDest)
    }
  }
}

/**
 * Hoist a single package directory from the .pnpm tree into the top-level node_modules.
 */
function hoistPackageDir(innerNodeModules, innerItem, nodeModulesDir) {
  const srcPath = join(innerNodeModules, innerItem)
  const destPath = join(nodeModulesDir, innerItem)

  const stats = lstatSync(srcPath)

  // Only hoist directories, skip symlinks inside .pnpm
  if (!stats.isDirectory()) return

  if (innerItem.startsWith('@')) {
    hoistScopedPackage(srcPath, destPath)
  } else if (!existsSync(destPath)) {
    copyDirectory(srcPath, destPath)
  }
}

/**
 * Fix PNPM symlinks for Next.js standalone output.
 * Replaces the .pnpm strict structure with a hoisted node_modules structure
 * by copying real files/directories and removing symlinks.
 */
function fixPnpmSymlinks(nodeModulesDir) {
  const pnpmDir = join(nodeModulesDir, '.pnpm')
  if (!existsSync(pnpmDir)) return

  // 1. Remove all symlinks in the top level node_modules
  removeTopLevelSymlinks(nodeModulesDir)

  // 2. Hoist every package from .pnpm/**/node_modules/* into node_modules/
  const pnpmPackages = readdirSync(pnpmDir)
  for (const pkg of pnpmPackages) {
    const innerNodeModules = join(pnpmDir, pkg, 'node_modules')
    if (existsSync(innerNodeModules)) {
      const innerItems = readdirSync(innerNodeModules)
      for (const innerItem of innerItems) {
        hoistPackageDir(innerNodeModules, innerItem, nodeModulesDir)
      }
    }
  }

  // 3. Clean up .pnpm folder
  rmSync(pnpmDir, { recursive: true, force: true })
}

/**
 * Recursively copy a directory, resolving symlinks to real files/directories.
 */
function copyDirectory(src, dest) {
  mkdirSync(dest, { recursive: true })
  const items = readdirSync(src)

  for (const item of items) {
    const srcPath = join(src, item)
    const destPath = join(dest, item)
    const stats = lstatSync(srcPath)

    if (stats.isDirectory()) {
      copyDirectory(srcPath, destPath)
    } else if (stats.isSymbolicLink()) {
      const target = readlinkSync(srcPath)
      const targetPath = join(dirname(srcPath), target)
      if (!existsSync(targetPath)) continue

      const targetStats = lstatSync(targetPath)
      if (targetStats.isDirectory()) {
        copyDirectory(targetPath, destPath)
      } else {
        copyFileSync(targetPath, destPath)
      }
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}
