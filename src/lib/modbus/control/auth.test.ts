import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadApiToken, verifyApiToken } from './auth'

const originalToken = process.env.MODBUS_API_TOKEN
const originalTokenFile = process.env.MODBUS_API_TOKEN_FILE

afterEach(() => {
  process.env.MODBUS_API_TOKEN = originalToken
  process.env.MODBUS_API_TOKEN_FILE = originalTokenFile
})

describe('control authentication', () => {
  it('loads and verifies environment tokens without exposing them', () => {
    process.env.MODBUS_API_TOKEN = 'correct-secret'
    delete process.env.MODBUS_API_TOKEN_FILE
    expect(loadApiToken()).toBe('correct-secret')
    expect(verifyApiToken('correct-secret')).toBe(true)
    expect(verifyApiToken('wrong-secret')).toBe(false)
  })

  it('loads a non-empty token file and rejects unreadable or empty files', () => {
    delete process.env.MODBUS_API_TOKEN
    const directory = mkdtempSync(join(tmpdir(), 'modbus-token-'))
    const tokenFile = join(directory, 'token.txt')
    const emptyFile = join(directory, 'empty.txt')
    writeFileSync(tokenFile, 'file-secret\n')
    writeFileSync(emptyFile, '')
    expect(loadApiToken({ tokenFile })).toBe('file-secret')
    expect(() => loadApiToken({ tokenFile: emptyFile })).toThrow('must not be empty')
    expect(() => loadApiToken({ tokenFile: join(directory, 'missing') })).toThrow(
      'could not be read'
    )
    rmSync(directory, { recursive: true, force: true })
  })
})
