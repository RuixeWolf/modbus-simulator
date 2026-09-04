import type { z } from 'zod'
import { bearerTokenFromRequest, verifyApiToken } from '@/src/lib/modbus/control/auth'
import { API_VERSION } from '@/src/lib/modbus/control/constants'
import {
  asControlError,
  CONTROL_ERROR_CODE,
  ControlError,
  validationError
} from '@/src/lib/modbus/control/errors'
import { getRuntimeCoordinator } from '@/src/lib/modbus/lifecycle'
import { logSourceStore } from '@/src/lib/modbus/log-context'

interface RouteHandlerContext {
  params: Promise<Record<string, string>>
}

interface ControlInput<TBody, TQuery, TParams> {
  request: Request
  body: TBody
  query: TQuery
  params: TParams
}

interface ControlHandlerOptions<TBody, TQuery, TParams> {
  public?: boolean
  body?: z.ZodType<TBody>
  query?: z.ZodType<TQuery>
  params?: z.ZodType<TParams>
}

function metadata() {
  return { apiVersion: API_VERSION, instanceId: getRuntimeCoordinator().instanceId }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  })
}

function validateRequestOrigin(request: Request): void {
  const hostHeader = request.headers.get('host')
  const requestUrl = new URL(request.url)
  if (hostHeader) {
    let hostName: string
    try {
      hostName = new URL(`http://${hostHeader}`).hostname
    } catch {
      throw new ControlError(CONTROL_ERROR_CODE.INVALID_HOST)
    }
    const configuredHost = process.env.MODBUS_HTTP_HOST || requestUrl.hostname
    const wildcard = configuredHost === '0.0.0.0' || configuredHost === '::'
    if (
      !wildcard &&
      hostName !== configuredHost &&
      !(hostName === 'localhost' && configuredHost === '127.0.0.1')
    ) {
      throw new ControlError(CONTROL_ERROR_CODE.INVALID_HOST)
    }
  }

  const origin = request.headers.get('origin')
  if (origin) {
    let originHost: string
    try {
      originHost = new URL(origin).host
    } catch {
      throw new ControlError(CONTROL_ERROR_CODE.ORIGIN_NOT_ALLOWED)
    }
    const expectedHost = hostHeader ?? requestUrl.host
    if (originHost !== expectedHost) throw new ControlError(CONTROL_ERROR_CODE.ORIGIN_NOT_ALLOWED)
  }
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return JSON.parse(await request.text())
  } catch {
    throw new ControlError(CONTROL_ERROR_CODE.MALFORMED_JSON)
  }
}

function parseWithSchema<T>(schema: z.ZodType<T> | undefined, input: unknown): T {
  if (!schema) return undefined as T
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw validationError(parsed.error)
  return parsed.data
}

export function withControlApi<TBody = undefined, TQuery = undefined, TParams = undefined>(
  options: ControlHandlerOptions<TBody, TQuery, TParams>,
  handler: (input: ControlInput<TBody, TQuery, TParams>) => unknown | Promise<unknown>
) {
  return async (request: Request, routeContext: RouteHandlerContext): Promise<Response> => {
    try {
      validateRequestOrigin(request)
      if (!options.public && !verifyApiToken(bearerTokenFromRequest(request))) {
        throw new ControlError(CONTROL_ERROR_CODE.UNAUTHORIZED)
      }

      const bodyInput = options.body ? await parseJson(request) : undefined
      const queryInput = Object.fromEntries(new URL(request.url).searchParams.entries())
      const paramsInput = routeContext ? await routeContext.params : undefined
      const input: ControlInput<TBody, TQuery, TParams> = {
        request,
        body: parseWithSchema(options.body, bodyInput),
        query: parseWithSchema(options.query, queryInput),
        params: parseWithSchema(options.params, paramsInput)
      }
      const source = {
        type: 'api' as const,
        detail: `${request.method} ${new URL(request.url).pathname}`
      }
      const data = await logSourceStore.run(source, () => handler(input))
      if (data instanceof Response) {
        data.headers.set('Cache-Control', 'no-store')
        return data
      }
      return json({ data, meta: metadata() })
    } catch (error) {
      const controlError = asControlError(error)
      return json(
        {
          error: {
            code: controlError.code,
            message: controlError.message,
            ...(controlError.issues ? { issues: controlError.issues } : {})
          },
          meta: metadata()
        },
        controlError.status
      )
    }
  }
}
