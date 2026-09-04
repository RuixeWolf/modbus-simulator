import { withControlApi } from '@/src/lib/api/control-handler'
import { ensureServersStarted } from '@/src/lib/modbus'
import { controlService } from '@/src/lib/modbus/control/service'

export const dynamic = 'force-dynamic'

void ensureServersStarted()

export const GET = withControlApi({}, () => controlService.tcpClients())
export const DELETE = withControlApi({}, () => controlService.disconnectAllClients())
