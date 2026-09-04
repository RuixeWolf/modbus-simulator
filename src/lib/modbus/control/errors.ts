import type { z } from 'zod'

export const CONTROL_ERROR_CODE = {
  MALFORMED_JSON: 'MALFORMED_JSON',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNAVAILABLE: 'UNAVAILABLE',
  INVALID_HOST: 'INVALID_HOST',
  ORIGIN_NOT_ALLOWED: 'ORIGIN_NOT_ALLOWED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const

export type ControlErrorCode = (typeof CONTROL_ERROR_CODE)[keyof typeof CONTROL_ERROR_CODE]

export interface ControlValidationIssue {
  path: string
  message: string
}

const ERROR_STATUS: Record<ControlErrorCode, number> = {
  MALFORMED_JSON: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAVAILABLE: 503,
  INVALID_HOST: 400,
  ORIGIN_NOT_ALLOWED: 403,
  INTERNAL_ERROR: 500
}

export const CONTROL_ERROR_MESSAGE: Record<ControlErrorCode, string> = {
  MALFORMED_JSON: 'Request body is not valid JSON.',
  VALIDATION_ERROR: 'Request validation failed.',
  UNAUTHORIZED: 'A valid Bearer token is required.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'The request conflicts with the current runtime state.',
  UNAVAILABLE: 'The runtime could not complete the requested operation.',
  INVALID_HOST: 'The request Host header is not allowed.',
  ORIGIN_NOT_ALLOWED: 'Cross-origin requests are not allowed.',
  INTERNAL_ERROR: 'An unexpected internal error occurred.'
}

export class ControlError extends Error {
  readonly code: ControlErrorCode
  readonly status: number
  readonly issues?: ControlValidationIssue[]

  constructor(
    code: ControlErrorCode,
    message = CONTROL_ERROR_MESSAGE[code],
    issues?: ControlValidationIssue[]
  ) {
    super(message)
    this.name = 'ControlError'
    this.code = code
    this.status = ERROR_STATUS[code]
    this.issues = issues
  }
}

export function validationError(error: z.ZodError): ControlError {
  return new ControlError(
    CONTROL_ERROR_CODE.VALIDATION_ERROR,
    CONTROL_ERROR_MESSAGE.VALIDATION_ERROR,
    error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message
    }))
  )
}

export function asControlError(error: unknown): ControlError {
  if (error instanceof ControlError) return error
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code in ERROR_STATUS &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    const candidate = error as {
      code: ControlErrorCode
      message: string
      issues?: ControlValidationIssue[]
    }
    return new ControlError(candidate.code, candidate.message, candidate.issues)
  }
  return new ControlError(CONTROL_ERROR_CODE.INTERNAL_ERROR)
}
