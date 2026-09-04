import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  asControlError,
  CONTROL_ERROR_CODE,
  CONTROL_ERROR_MESSAGE,
  ControlError,
  validationError
} from './errors'

describe('control errors', () => {
  it.each([
    [CONTROL_ERROR_CODE.MALFORMED_JSON, 400],
    [CONTROL_ERROR_CODE.VALIDATION_ERROR, 422],
    [CONTROL_ERROR_CODE.UNAUTHORIZED, 401],
    [CONTROL_ERROR_CODE.NOT_FOUND, 404],
    [CONTROL_ERROR_CODE.CONFLICT, 409],
    [CONTROL_ERROR_CODE.UNAVAILABLE, 503]
  ])('maps %s to its stable status and English message', (code, status) => {
    const error = new ControlError(code)
    expect(error.status).toBe(status)
    expect(error.message).toBe(CONTROL_ERROR_MESSAGE[code])
  })

  it('maps Zod issues to field paths', () => {
    const result = z.strictObject({ count: z.number().int().positive() }).safeParse({ count: 0 })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(validationError(result.error).issues).toEqual([
      expect.objectContaining({ path: 'count', message: expect.any(String) })
    ])
  })

  it('preserves control errors that cross a bundle boundary', () => {
    const normalized = asControlError({
      name: 'ControlError',
      code: 'UNAVAILABLE',
      status: 503,
      message: 'Listener unavailable.'
    })
    expect(normalized).toMatchObject({
      code: 'UNAVAILABLE',
      status: 503,
      message: 'Listener unavailable.'
    })
  })
})
