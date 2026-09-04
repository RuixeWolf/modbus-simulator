import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const skillRoot = join(process.cwd(), 'skills', 'modbus-simulator')

describe('modbus-simulator Skill package', () => {
  it('contains the exact latest-package readiness command and valid references', () => {
    const skill = readFileSync(join(skillRoot, 'SKILL.md'), 'utf8')
    expect(skill).toContain(
      'npx --yes @ruixe/modbus-simulator@latest --host 127.0.0.1 --port 15000 --tcp-host 127.0.0.1 --tcp-port 15020 --ready-output json --ready-timeout 30 --strict-ready'
    )
    for (const match of skill.matchAll(/\]\(([^)]+\.md)\)/g)) {
      expect(existsSync(join(dirname(join(skillRoot, 'SKILL.md')), match[1]))).toBe(true)
    }
    expect(existsSync(join(skillRoot, 'scripts', 'control.mjs'))).toBe(true)
  })
})
