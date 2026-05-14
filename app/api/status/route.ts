import { NextResponse } from 'next/server'
import {
  ensureServersStarted,
  isRTUSerialServerRunning,
  isTCPServerRunning
} from '@/src/lib/modbus'

ensureServersStarted()

export async function GET() {
  return NextResponse.json({
    tcp: isTCPServerRunning(),
    rtu: isRTUSerialServerRunning()
  })
}
