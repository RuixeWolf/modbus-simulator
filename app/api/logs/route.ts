import { NextResponse } from 'next/server'
import { ensureServersStarted } from '@/src/lib/modbus'
import { ModbusEngine } from '@/src/lib/modbus/engine'

export const dynamic = 'force-dynamic'

ensureServersStarted()

export async function GET() {
  const engine = ModbusEngine.getInstance()
  return NextResponse.json(engine.getLogs())
}

export async function DELETE() {
  const engine = ModbusEngine.getInstance()
  engine.clearLogs()
  return NextResponse.json({ success: true })
}
