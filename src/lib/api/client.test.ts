import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ControlApiError,
  controlRequest,
  SESSION_STORAGE_ENTRY,
  validateAndStoreControlToken
} from './client'

describe('Dashboard v1 API client', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('adds session Bearer auth without placing tokens in URLs', async () => {
    sessionStorage.setItem(SESSION_STORAGE_ENTRY, 'session-secret')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json({ data: { ready: true }, meta: { apiVersion: '1', instanceId: 'id' } })
      )
    await controlRequest('/api/v1/health')
    const [request] = fetchMock.mock.calls[0]
    expect(request).toBeInstanceOf(Request)
    expect((request as Request).url).toBe('http://localhost:3000/api/v1/health')
    expect((request as Request).url).not.toContain('session-secret')
    expect((request as Request).headers.get('authorization')).toBe('Bearer session-secret')
  })

  it('surfaces stable 401 and malformed response errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json(
        {
          error: { code: 'UNAUTHORIZED', message: 'A valid Bearer token is required.' },
          meta: { apiVersion: '1', instanceId: 'id' }
        },
        { status: 401 }
      )
    )
    await expect(controlRequest('/api/v1/health')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401
    })

    vi.mocked(fetch).mockResolvedValueOnce(new Response('not json', { status: 200 }))
    await expect(controlRequest('/api/v1/health')).rejects.toBeInstanceOf(ControlApiError)
  })

  it('stores only a validated token in sessionStorage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({ data: { ready: true }, meta: { apiVersion: '1', instanceId: 'id' } })
    )
    await validateAndStoreControlToken('valid-secret')
    expect(sessionStorage.getItem(SESSION_STORAGE_ENTRY)).toBe('valid-secret')
    expect(localStorage.length).toBe(0)

    sessionStorage.clear()
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json(
        {
          error: { code: 'UNAUTHORIZED', message: 'No.' },
          meta: { apiVersion: '1', instanceId: 'id' }
        },
        { status: 401 }
      )
    )
    await expect(validateAndStoreControlToken('bad-secret')).rejects.toBeInstanceOf(ControlApiError)
    expect(sessionStorage.getItem(SESSION_STORAGE_ENTRY)).toBeNull()
  })
})
