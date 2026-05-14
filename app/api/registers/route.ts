import { NextRequest, NextResponse } from 'next/server'
import { ensureServersStarted } from '@/src/lib/modbus'
import { ModbusEngine } from '@/src/lib/modbus/engine'

ensureServersStarted()

export async function GET() {
  const engine = ModbusEngine.getInstance()
  return NextResponse.json(engine.getState())
}

export async function POST(request: NextRequest) {
  const engine = ModbusEngine.getInstance()
  const body = await request.json()

  const { registerType, address, value } = body

  try {
    if (registerType === 'holdingRegister') {
      engine.writeHoldingRegister(address, value)
    } else if (registerType === 'coil') {
      engine.writeCoil(address, value)
    } else if (registerType === 'inputRegister') {
      engine.writeInputRegister(address, value)
    } else if (registerType === 'discreteInput') {
      engine.writeDiscreteInput(address, value)
    } else {
      return NextResponse.json({ error: 'Unsupported register type' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    engine.addErrorLog(registerType || 'unknown', address ?? -1, (e as Error).message)
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
