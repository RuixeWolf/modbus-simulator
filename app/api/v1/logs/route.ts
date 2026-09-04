import { withControlApi } from '@/src/lib/api/control-handler'
import { ensureServersStarted } from '@/src/lib/modbus'
import { logQuerySchema } from '@/src/lib/modbus/control/schemas'
import { controlService } from '@/src/lib/modbus/control/service'

export const dynamic = 'force-dynamic'

void ensureServersStarted()

export const GET = withControlApi({ query: logQuerySchema }, ({ query }) =>
  controlService.logs(query)
)
export const DELETE = withControlApi({}, () => controlService.clearLogs())
