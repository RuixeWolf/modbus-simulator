import { NextResponse } from 'next/server'
import { ensureServersStarted } from '@/src/lib/modbus'
import { ModbusEngine } from '@/src/lib/modbus/engine'

ensureServersStarted()

export async function GET() {
  const engine = ModbusEngine.getInstance()
  return NextResponse.json(engine.getLogs())
}
