import { z } from 'zod'
import { DATA_TYPES } from '../buffer-convert'
import { MODBUS_LOG_TYPE, MODBUS_TABLE } from '../engine'
import { API_VERSION, MAX_RANGE_VALUES, TRANSPORT_STATE } from './constants'

export const tableSchema = z.enum(Object.values(MODBUS_TABLE))
export const dataTypeSchema = z.enum(DATA_TYPES)
export const transportStateSchema = z.enum(Object.values(TRANSPORT_STATE))
export const logTypeSchema = z.enum(Object.values(MODBUS_LOG_TYPE))
export const logSourceTypeSchema = z.enum(['tcp', 'serial', 'web', 'api'])

export const logFilterSchema = z.strictObject({
  read: z.boolean(),
  write: z.boolean(),
  error: z.boolean(),
  connection: z.boolean(),
  system: z.boolean()
})

export const serverConfigSchema = z.strictObject({
  tcpEnabled: z.boolean(),
  tcpHost: z.string().min(1).max(255),
  tcpPort: z.number().int().min(1).max(65535),
  slaveId: z.number().int().min(1).max(247),
  rtuEnabled: z.boolean(),
  rtuSerialPath: z.string().min(1).max(1024).nullable(),
  rtuBaudRate: z.number().int().min(300).max(115200),
  rtuParity: z.enum(['none', 'even', 'odd']),
  rtuDataBits: z.union([z.literal(5), z.literal(6), z.literal(7), z.literal(8)]),
  rtuStopBits: z.union([z.literal(1), z.literal(2)]),
  logMaxCount: z.number().int().min(100).max(10000),
  logFilter: logFilterSchema
})

export const serverConfigPatchSchema = serverConfigSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one configuration field is required'
  })

export const tcpActualConfigSchema = z.strictObject({
  host: z.string(),
  port: z.number().int(),
  slaveId: z.number().int()
})

export const rtuActualConfigSchema = z.strictObject({
  serialPath: z.string(),
  baudRate: z.number().int(),
  parity: z.enum(['none', 'even', 'odd']),
  dataBits: z.number().int(),
  stopBits: z.number().int(),
  slaveId: z.number().int()
})

export const tcpLifecycleSchema = z.strictObject({
  state: transportStateSchema,
  lastTransitionAt: z.iso.datetime(),
  error: z.string().nullable(),
  actualConfig: tcpActualConfigSchema.nullable()
})

export const rtuLifecycleSchema = z.strictObject({
  state: transportStateSchema,
  lastTransitionAt: z.iso.datetime(),
  error: z.string().nullable(),
  actualConfig: rtuActualConfigSchema.nullable()
})

export const lifecycleSchema = z.strictObject({
  tcp: tcpLifecycleSchema,
  rtu: rtuLifecycleSchema
})

export const metadataSchema = z.strictObject({
  apiVersion: z.literal(API_VERSION),
  instanceId: z.uuid()
})

export const validationIssueSchema = z.strictObject({
  path: z.string(),
  message: z.string()
})

export const errorBodySchema = z.strictObject({
  code: z.string(),
  message: z.string(),
  issues: z.array(validationIssueSchema).optional()
})

export const errorEnvelopeSchema = z.strictObject({
  error: errorBodySchema,
  meta: metadataSchema
})

export function successEnvelopeSchema<T extends z.ZodType>(data: T) {
  return z.strictObject({ data, meta: metadataSchema })
}

export const stateSchema = z.strictObject({
  coils: z.array(z.boolean()),
  discreteInputs: z.array(z.boolean()),
  holdingRegisters: z.array(z.number().int().min(0).max(65535)),
  inputRegisters: z.array(z.number().int().min(0).max(65535))
})

export const resetRequestSchema = z.strictObject({
  tables: z.array(tableSchema).min(1).max(4).optional(),
  clearLogs: z.boolean().optional()
})

export const rangeQuerySchema = z.strictObject({
  start: z.coerce.number().int().min(0),
  count: z.coerce.number().int().min(1).max(MAX_RANGE_VALUES)
})

const rangeStartSchema = z.number().int().min(0)
const booleanValuesSchema = z.array(z.boolean()).min(1).max(MAX_RANGE_VALUES)
const registerValuesSchema = z
  .array(z.number().int().min(0).max(65535))
  .min(1)
  .max(MAX_RANGE_VALUES)

export const booleanRangeWriteSchema = z.strictObject({
  start: rangeStartSchema,
  values: booleanValuesSchema
})

export const registerRangeWriteSchema = z.strictObject({
  start: rangeStartSchema,
  values: registerValuesSchema
})

export const encodedWriteSchema = z.union([
  z.strictObject({
    address: rangeStartSchema,
    dataType: dataTypeSchema,
    value: z.number().finite()
  }),
  z.strictObject({
    address: rangeStartSchema,
    bytes: z.string().min(1).max(8192)
  })
])

export const logSourceSchema = z.strictObject({
  type: logSourceTypeSchema,
  detail: z.string()
})

export const logEntrySchema = z.strictObject({
  id: z.number().int().positive(),
  timestamp: z.iso.datetime(),
  type: logTypeSchema,
  registerType: z.string(),
  address: z.number().int(),
  value: z.union([z.number(), z.boolean()]).optional(),
  message: z.string().optional(),
  source: logSourceSchema.optional()
})

export const logQuerySchema = z.strictObject({
  afterId: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_RANGE_VALUES).optional(),
  type: logTypeSchema.optional(),
  source: logSourceTypeSchema.optional()
})

export const tcpClientSchema = z.strictObject({
  id: z.number().int().positive(),
  host: z.string(),
  port: z.number().int().min(0).max(65535),
  connectedAt: z.iso.datetime()
})

export const serialPortSchema = z.strictObject({
  path: z.string(),
  manufacturer: z.string().nullable(),
  serialNumber: z.string().nullable()
})

export type ServerConfig = z.infer<typeof serverConfigSchema>
export type ServerConfigPatch = z.infer<typeof serverConfigPatchSchema>
export type RangeQuery = z.infer<typeof rangeQuerySchema>
export type EncodedWrite = z.infer<typeof encodedWriteSchema>
