import { NextResponse } from 'next/server'
import { SerialPort } from 'serialport'
import { ensureServersStarted } from '@/src/lib/modbus'

ensureServersStarted()

export async function GET() {
  try {
    const ports = await SerialPort.list()
    const result = ports.map((port) => ({
      path: port.path,
      manufacturer: port.manufacturer || null,
      serialNumber: port.serialNumber || null
    }))
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
