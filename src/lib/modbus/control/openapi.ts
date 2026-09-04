import { z } from 'zod'
import { createDocument } from 'zod-openapi'
import { API_VERSION, PACKAGE_VERSION } from './constants'
import {
  booleanRangeWriteSchema,
  encodedWriteSchema,
  errorEnvelopeSchema,
  logQuerySchema,
  rangeQuerySchema,
  registerRangeWriteSchema,
  resetRequestSchema,
  serverConfigPatchSchema,
  tableSchema
} from './schemas'

export const CONTROL_ROUTE_CONTRACT = {
  '/api/v1': ['get'],
  '/api/v1/openapi.json': ['get'],
  '/api/v1/health': ['get'],
  '/api/v1/state': ['get'],
  '/api/v1/state/reset': ['post'],
  '/api/v1/registers/{table}': ['get', 'put'],
  '/api/v1/registers/{table}/encoded': ['put'],
  '/api/v1/config': ['get', 'patch'],
  '/api/v1/logs': ['get', 'delete'],
  '/api/v1/serial-ports': ['get'],
  '/api/v1/tcp-clients': ['get', 'delete'],
  '/api/v1/tcp-clients/{id}': ['delete']
} as const

const jsonResponse = (description: string, schema: z.ZodType) => ({
  description,
  content: { 'application/json': { schema } }
})

const standardErrors = {
  '400': jsonResponse('Malformed request', errorEnvelopeSchema),
  '401': jsonResponse('Authentication required', errorEnvelopeSchema),
  '403': jsonResponse('Request origin is forbidden', errorEnvelopeSchema),
  '404': jsonResponse('Resource not found', errorEnvelopeSchema),
  '409': jsonResponse('Runtime conflict', errorEnvelopeSchema),
  '422': jsonResponse('Validation failed', errorEnvelopeSchema),
  '503': jsonResponse('Runtime unavailable', errorEnvelopeSchema)
}

const successSchema = z.strictObject({
  data: z.unknown(),
  meta: z.strictObject({ apiVersion: z.literal(API_VERSION), instanceId: z.uuid() })
})

const securedOperation = {
  security: [{ bearerAuth: [] }]
}

export function createControlOpenApiDocument() {
  return createDocument({
    openapi: '3.1.0',
    info: {
      title: 'Modbus Simulator Control API',
      version: PACKAGE_VERSION,
      description: 'Strict versioned control plane for Modbus Simulator automation.'
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Configured through MODBUS_API_TOKEN or --api-token-file.'
        }
      }
    },
    paths: {
      '/api/v1': {
        get: { responses: { '200': jsonResponse('API discovery', successSchema) } }
      },
      '/api/v1/openapi.json': {
        get: { responses: { '200': { description: 'OpenAPI document' } } }
      },
      '/api/v1/health': {
        get: {
          ...securedOperation,
          responses: { '200': jsonResponse('Runtime health', successSchema), ...standardErrors }
        }
      },
      '/api/v1/state': {
        get: {
          ...securedOperation,
          responses: {
            '200': jsonResponse('Full state snapshot', successSchema),
            ...standardErrors
          }
        }
      },
      '/api/v1/state/reset': {
        post: {
          ...securedOperation,
          requestBody: { content: { 'application/json': { schema: resetRequestSchema } } },
          responses: { '200': jsonResponse('Reset state', successSchema), ...standardErrors }
        }
      },
      '/api/v1/registers/{table}': {
        get: {
          ...securedOperation,
          requestParams: { path: z.object({ table: tableSchema }), query: rangeQuerySchema },
          responses: { '200': jsonResponse('Register range', successSchema), ...standardErrors }
        },
        put: {
          ...securedOperation,
          requestParams: { path: z.object({ table: tableSchema }) },
          requestBody: {
            content: {
              'application/json': {
                schema: z.union([booleanRangeWriteSchema, registerRangeWriteSchema])
              }
            }
          },
          responses: { '200': jsonResponse('Written range', successSchema), ...standardErrors }
        }
      },
      '/api/v1/registers/{table}/encoded': {
        put: {
          ...securedOperation,
          requestParams: { path: z.object({ table: tableSchema }) },
          requestBody: { content: { 'application/json': { schema: encodedWriteSchema } } },
          responses: { '200': jsonResponse('Encoded write', successSchema), ...standardErrors }
        }
      },
      '/api/v1/config': {
        get: {
          ...securedOperation,
          responses: {
            '200': jsonResponse('Runtime configuration', successSchema),
            ...standardErrors
          }
        },
        patch: {
          ...securedOperation,
          requestBody: { content: { 'application/json': { schema: serverConfigPatchSchema } } },
          responses: {
            '200': jsonResponse('Applied configuration', successSchema),
            ...standardErrors
          }
        }
      },
      '/api/v1/logs': {
        get: {
          ...securedOperation,
          requestParams: { query: logQuerySchema },
          responses: { '200': jsonResponse('Cursor logs', successSchema), ...standardErrors }
        },
        delete: {
          ...securedOperation,
          responses: { '200': jsonResponse('Cleared logs', successSchema), ...standardErrors }
        }
      },
      '/api/v1/serial-ports': {
        get: {
          ...securedOperation,
          responses: { '200': jsonResponse('Serial ports', successSchema), ...standardErrors }
        }
      },
      '/api/v1/tcp-clients': {
        get: {
          ...securedOperation,
          responses: { '200': jsonResponse('TCP clients', successSchema), ...standardErrors }
        },
        delete: {
          ...securedOperation,
          responses: {
            '200': jsonResponse('Disconnected clients', successSchema),
            ...standardErrors
          }
        }
      },
      '/api/v1/tcp-clients/{id}': {
        delete: {
          ...securedOperation,
          requestParams: { path: z.object({ id: z.coerce.number().int().positive() }) },
          responses: {
            '200': jsonResponse('Disconnected client', successSchema),
            ...standardErrors
          }
        }
      }
    }
  })
}

let cachedDocument: ReturnType<typeof createControlOpenApiDocument> | null = null

export function getControlOpenApiDocument() {
  cachedDocument ??= createControlOpenApiDocument()
  return cachedDocument
}
