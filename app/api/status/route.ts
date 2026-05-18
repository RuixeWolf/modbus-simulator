import { NextResponse } from 'next/server'
import {
  ensureServersStarted,
  isRTUSerialServerRunning,
  isTCPServerRunning
} from '@/src/lib/modbus'

export const dynamic = 'force-dynamic'

ensureServersStarted()

export async function GET() {
  return NextResponse.json({
    tcp: isTCPServerRunning(),
    rtu: isRTUSerialServerRunning()
  })
}
