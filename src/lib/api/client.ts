'use client'

export const SESSION_STORAGE_ENTRY = 'modbus-simulator-control'

export interface ApiIssue {
  path: string
  message: string
}

interface ApiErrorBody {
  code: string
  message: string
  issues?: ApiIssue[]
}

interface SuccessEnvelope<T> {
  data: T
  meta: { apiVersion: string; instanceId: string }
}

interface ErrorEnvelope {
  error: ApiErrorBody
  meta: { apiVersion: string; instanceId: string }
}

export class ControlApiError extends Error {
  readonly code: string
  readonly status: number
  readonly issues?: ApiIssue[]

  constructor(status: number, error: ApiErrorBody) {
    super(error.message)
    this.name = 'ControlApiError'
    this.code = error.code
    this.status = status
    this.issues = error.issues
  }
}

function currentToken(): string | null {
  if (!('window' in globalThis)) return null
  return sessionStorage.getItem(SESSION_STORAGE_ENTRY)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  )
}

function isSuccessEnvelope<T>(value: unknown): value is SuccessEnvelope<T> {
  return (
    isRecord(value) &&
    'data' in value &&
    isRecord(value.meta) &&
    typeof value.meta.apiVersion === 'string'
  )
}

export async function controlRequest<T>(
  path: string,
  init: RequestInit = {},
  tokenOverride?: string | null
): Promise<T> {
  const url = new URL(path, window.location.origin)
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/v1/')) {
    throw new Error('Control API paths must be same-origin routes under /api/v1/')
  }
  const token = tokenOverride === undefined ? currentToken() : tokenOverride
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  if (token) headers.set('authorization', `Bearer ${token}`)

  // The URL is constrained above to this browser origin and the versioned control API.
  // nosemgrep
  const apiRequest = new Request(url, { ...init, cache: 'no-store', headers })
  // nosemgrep
  const response = await fetch(apiRequest)
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ControlApiError(response.status, {
      code: 'MALFORMED_RESPONSE',
      message: 'The control API returned malformed JSON.'
    })
  }

  if (!response.ok) {
    if (isErrorEnvelope(payload)) throw new ControlApiError(response.status, payload.error)
    throw new ControlApiError(response.status, {
      code: 'MALFORMED_RESPONSE',
      message: 'The control API returned an invalid error envelope.'
    })
  }
  if (!isSuccessEnvelope<T>(payload)) {
    throw new ControlApiError(response.status, {
      code: 'MALFORMED_RESPONSE',
      message: 'The control API returned an invalid success envelope.'
    })
  }
  return payload.data
}

export async function validateAndStoreControlToken(token: string): Promise<void> {
  const trimmed = token.trim()
  if (!trimmed)
    throw new ControlApiError(401, { code: 'UNAUTHORIZED', message: 'A Token is required.' })
  await controlRequest('/api/v1/health', {}, trimmed)
  sessionStorage.setItem(SESSION_STORAGE_ENTRY, trimmed)
}

export function clearControlToken(): void {
  if ('window' in globalThis) sessionStorage.removeItem(SESSION_STORAGE_ENTRY)
}
