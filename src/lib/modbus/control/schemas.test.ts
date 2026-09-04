import { describe, expect, it } from 'vitest'
import {
  booleanRangeWriteSchema,
  encodedWriteSchema,
  rangeQuerySchema,
  resetRequestSchema,
  serverConfigPatchSchema
} from './schemas'

describe('control schemas', () => {
  it('accepts valid strict control requests', () => {
    expect(resetRequestSchema.parse({ tables: ['holding-registers'], clearLogs: true })).toEqual({
      tables: ['holding-registers'],
      clearLogs: true
    })
    expect(booleanRangeWriteSchema.parse({ start: 0, values: [true, false] })).toBeTruthy()
    expect(encodedWriteSchema.parse({ address: 2, dataType: 'Float3412', value: 1.5 })).toBeTruthy()
  })

  it('rejects unknown fields', () => {
    expect(serverConfigPatchSchema.safeParse({ tcpPort: 1502, secret: 'nope' }).success).toBe(false)
  })

  it('enforces request limits and boundaries', () => {
    expect(rangeQuerySchema.safeParse({ start: '-1', count: '1' }).success).toBe(false)
    expect(rangeQuerySchema.safeParse({ start: '0', count: '1001' }).success).toBe(false)
    expect(booleanRangeWriteSchema.safeParse({ start: 0, values: [1] }).success).toBe(false)
  })
})
