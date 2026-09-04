import { withControlApi } from '@/src/lib/api/control-handler'
import { ensureServersStarted } from '@/src/lib/modbus'
import { resetRequestSchema } from '@/src/lib/modbus/control/schemas'
import { controlService } from '@/src/lib/modbus/control/service'

export const dynamic = 'force-dynamic'

void ensureServersStarted()

export const POST = withControlApi({ body: resetRequestSchema }, ({ body }) =>
  controlService.reset(body.tables, body.clearLogs ?? false)
)
