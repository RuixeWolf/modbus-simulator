import { z } from 'zod'
import { withControlApi } from '@/src/lib/api/control-handler'
import { ensureServersStarted } from '@/src/lib/modbus'
import { encodedWriteSchema, tableSchema } from '@/src/lib/modbus/control/schemas'
import { controlService } from '@/src/lib/modbus/control/service'

export const dynamic = 'force-dynamic'

void ensureServersStarted()

const paramsSchema = z.strictObject({ table: tableSchema })

export const PUT = withControlApi(
  { body: encodedWriteSchema, params: paramsSchema },
  ({ body, params }) => controlService.writeEncoded(params.table, body)
)
