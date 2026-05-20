import { NextRequest, NextResponse } from 'next/server'
import { ensureServersStarted } from '@/src/lib/modbus'
import { ModbusEngine } from '@/src/lib/modbus/engine'
import { logSourceStore } from '@/src/lib/modbus/log-context'

export const dynamic = 'force-dynamic'

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
    const webSource = { type: 'web' as const, detail: 'Web Console' }
    await logSourceStore.run(webSource, async () => {
      if (registerType === 'holdingRegister') {
        engine.writeHoldingRegister(address, value)
      } else if (registerType === 'coil') {
        engine.writeCoil(address, value)
      } else if (registerType === 'inputRegister') {
        engine.writeInputRegister(address, value)
      } else if (registerType === 'discreteInput') {
        engine.writeDiscreteInput(address, value)
      } else {
        throw new Error('Unsupported register type')
      }
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    engine.addErrorLog(registerType || 'unknown', address ?? -1, (e as Error).message)
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
