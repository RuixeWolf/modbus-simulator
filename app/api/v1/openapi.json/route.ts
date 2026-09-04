import { withControlApi } from '@/src/lib/api/control-handler'
import { ensureServersStarted } from '@/src/lib/modbus'
import { getControlOpenApiDocument } from '@/src/lib/modbus/control/openapi'

export const dynamic = 'force-dynamic'

void ensureServersStarted()

export const GET = withControlApi({ public: true }, () =>
  Response.json(getControlOpenApiDocument())
)
