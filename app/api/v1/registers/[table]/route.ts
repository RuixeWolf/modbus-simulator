import { z } from 'zod'
import { withControlApi } from '@/src/lib/api/control-handler'
import { ensureServersStarted } from '@/src/lib/modbus'
import {
  booleanRangeWriteSchema,
  rangeQuerySchema,
  registerRangeWriteSchema,
  tableSchema
} from '@/src/lib/modbus/control/schemas'
import { controlService } from '@/src/lib/modbus/control/service'
import { MODBUS_TABLE } from '@/src/lib/modbus/engine'

export const dynamic = 'force-dynamic'

void ensureServersStarted()

const paramsSchema = z.strictObject({ table: tableSchema })
const writeSchema = z.union([booleanRangeWriteSchema, registerRangeWriteSchema])

export const GET = withControlApi(
  { query: rangeQuerySchema, params: paramsSchema },
  ({ query, params }) => controlService.readRange(params.table, query)
)

export const PUT = withControlApi(
  { body: writeSchema, params: paramsSchema },
  ({ body, params }) => {
    const bitTable =
      params.table === MODBUS_TABLE.COILS || params.table === MODBUS_TABLE.DISCRETE_INPUTS
    if (bitTable) {
      return controlService.writeRange(
        params.table,
        body.start,
        booleanRangeWriteSchema.parse(body).values
      )
    }
    return controlService.writeRange(
      params.table,
      body.start,
      registerRangeWriteSchema.parse(body).values
    )
  }
)
