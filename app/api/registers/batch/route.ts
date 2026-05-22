import { NextRequest, NextResponse } from 'next/server'
import { ensureServersStarted } from '@/src/lib/modbus'
import { numberToBuffer, parseHexString, type DataType } from '@/src/lib/modbus/buffer-convert'
import { ModbusEngine } from '@/src/lib/modbus/engine'
import { logSourceStore } from '@/src/lib/modbus/log-context'

export const dynamic = 'force-dynamic'

ensureServersStarted()

const VALID_DATA_TYPES: readonly string[] = [
  'UIntBE',
  'UIntLE',
  'UInt8',
  'UInt16BE',
  'UInt16LE',
  'UInt32BE',
  'UInt32LE',
  'IntBE',
  'IntLE',
  'Int8',
  'Int16BE',
  'Int16LE',
  'Int32BE',
  'Int32LE',
  'FloatBE',
  'FloatLE',
  'Float1234',
  'Float2143',
  'Float3412',
  'Float4321',
  'DoubleBE',
  'DoubleLE'
]

function isDataType(value: unknown): value is DataType {
  return typeof value === 'string' && VALID_DATA_TYPES.includes(value)
}

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export async function POST(request: NextRequest) {
  const engine = ModbusEngine.getInstance()
  const body = await request.json()

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { registerType, startAddress, mode, dataType, value, hexString } = body

  if (!registerType || (registerType !== 'holdingRegister' && registerType !== 'inputRegister')) {
    return NextResponse.json(
      { error: 'registerType must be holdingRegister or inputRegister' },
      { status: 400 }
    )
  }

  const addr = Number(startAddress)
  if (!Number.isInteger(addr) || addr < 0 || addr >= 10000) {
    return NextResponse.json({ error: 'Invalid startAddress (must be 0–9999)' }, { status: 400 })
  }

  if (mode !== 'number' && mode !== 'bytes') {
    return NextResponse.json({ error: 'mode must be "number" or "bytes"' }, { status: 400 })
  }

  try {
    let buffer: Buffer

    if (mode === 'number') {
      if (!isDataType(dataType) || typeof value !== 'number' || !Number.isFinite(value)) {
        return NextResponse.json(
          { error: 'dataType and a finite numeric value are required for number mode' },
          { status: 400 }
        )
      }
      buffer = numberToBuffer(dataType, value)
    } else {
      if (!hexString || typeof hexString !== 'string') {
        return NextResponse.json({ error: 'hexString required for bytes mode' }, { status: 400 })
      }
      buffer = parseHexString(hexString)
      if (buffer.length === 0) {
        return NextResponse.json({ error: 'Invalid hex string' }, { status: 400 })
      }
    }

    const registerCount = Math.ceil(buffer.length / 2)
    if (addr + registerCount > 10000) {
      return NextResponse.json({ error: 'Write exceeds register bounds' }, { status: 400 })
    }

    const webSource = { type: 'web' as const, detail: 'Web Console' }
    await logSourceStore.run(webSource, async () => {
      for (let i = 0; i < registerCount; i++) {
        const high = buffer[i * 2] ?? 0
        const low = buffer[i * 2 + 1] ?? 0
        const regValue = (high << 8) | low
        if (registerType === 'holdingRegister') {
          engine.writeHoldingRegister(addr + i, regValue)
        } else {
          engine.writeInputRegister(addr + i, regValue)
        }
      }
    })

    return NextResponse.json({ success: true, registersWritten: registerCount })
  } catch (e) {
    const message = getErrorMessage(e)
    engine.addErrorLog(registerType, addr, message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
