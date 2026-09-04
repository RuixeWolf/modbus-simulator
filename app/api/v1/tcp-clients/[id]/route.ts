import { z } from 'zod'
import { withControlApi } from '@/src/lib/api/control-handler'
import { ensureServersStarted } from '@/src/lib/modbus'
import { controlService } from '@/src/lib/modbus/control/service'

export const dynamic = 'force-dynamic'

void ensureServersStarted()

const paramsSchema = z.strictObject({ id: z.coerce.number().int().positive() })

export const DELETE = withControlApi({ params: paramsSchema }, ({ params }) =>
  controlService.disconnectClient(params.id)
)
