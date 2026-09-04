import { createHash, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { CONTROL_ERROR_CODE, ControlError } from './errors'

export interface TokenInputOptions {
  env?: NodeJS.ProcessEnv
  tokenFile?: string | null
}

export function loadApiToken(options: TokenInputOptions = {}): string | null {
  const env = options.env ?? process.env
  if (env.MODBUS_API_TOKEN?.trim()) return env.MODBUS_API_TOKEN.trim()
  const tokenFile = options.tokenFile ?? env.MODBUS_API_TOKEN_FILE
  if (!tokenFile) return null
  let token: string
  try {
    token = readFileSync(tokenFile, 'utf8').trim()
  } catch {
    throw new ControlError(CONTROL_ERROR_CODE.UNAVAILABLE, 'API token file could not be read.')
  }
  if (!token) {
    throw new ControlError(CONTROL_ERROR_CODE.UNAVAILABLE, 'API token file must not be empty.')
  }
  return token
}

function digestToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest()
}

export function verifyApiToken(candidate: string | null, configured = loadApiToken()): boolean {
  if (!configured) return true
  if (!candidate) return false
  return timingSafeEqual(digestToken(candidate), digestToken(configured))
}

export function bearerTokenFromRequest(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length).trim()
  return token || null
}

export function isLoopbackHost(host: string): boolean {
  const normalized = host
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
}
