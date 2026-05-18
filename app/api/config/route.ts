import { NextRequest, NextResponse } from 'next/server'
import { ensureServersStarted, getConfig, restartServers, setConfig } from '@/src/lib/modbus'
import { ModbusEngine } from '@/src/lib/modbus/engine'

ensureServersStarted()

export async function GET() {
  const config = getConfig()
  const engine = ModbusEngine.getInstance()
  return NextResponse.json({ ...config, logFilter: engine.getLogFilter() })
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const updates: {
    tcpPort?: number
    slaveId?: number
    rtuSerialPath?: string | null
    rtuBaudRate?: number
    rtuParity?: 'none' | 'even' | 'odd'
    rtuDataBits?: number
    rtuStopBits?: number
  } = {}

  if (body.tcpPort !== undefined) {
    const port = Number(body.tcpPort)
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      return NextResponse.json({ error: 'Invalid TCP port' }, { status: 400 })
    }
    updates.tcpPort = port
  }

  if (body.slaveId !== undefined) {
    const sid = Number(body.slaveId)
    if (!Number.isInteger(sid) || sid < 1 || sid > 247) {
      return NextResponse.json(
        { error: 'Invalid slave ID (must be an integer 1-247)' },
        { status: 400 }
      )
    }
    updates.slaveId = sid
  }

  if (body.rtuSerialPath !== undefined) {
    updates.rtuSerialPath =
      body.rtuSerialPath === null || body.rtuSerialPath === '' ? null : String(body.rtuSerialPath)
  }

  if (body.rtuBaudRate !== undefined) {
    const br = Number(body.rtuBaudRate)
    if (Number.isNaN(br) || br < 300 || br > 115200) {
      return NextResponse.json({ error: 'Invalid baud rate' }, { status: 400 })
    }
    updates.rtuBaudRate = br
  }

  if (body.rtuParity !== undefined) {
    const p = String(body.rtuParity)
    if (!['none', 'even', 'odd'].includes(p)) {
      return NextResponse.json({ error: 'Invalid parity' }, { status: 400 })
    }
    updates.rtuParity = p as 'none' | 'even' | 'odd'
  }

  if (body.rtuDataBits !== undefined) {
    const db = Number(body.rtuDataBits)
    if (![5, 6, 7, 8].includes(db)) {
      return NextResponse.json({ error: 'Invalid data bits' }, { status: 400 })
    }
    updates.rtuDataBits = db
  }

  if (body.rtuStopBits !== undefined) {
    const sb = Number(body.rtuStopBits)
    if (![1, 2].includes(sb)) {
      return NextResponse.json({ error: 'Invalid stop bits' }, { status: 400 })
    }
    updates.rtuStopBits = sb
  }

  if (body.logFilter !== undefined && typeof body.logFilter === 'object') {
    const engine = ModbusEngine.getInstance()
    engine.setLogFilter({
      read: body.logFilter.read,
      write: body.logFilter.write,
      error: body.logFilter.error
    })
  }

  setConfig(updates)
  restartServers()

  const engine = ModbusEngine.getInstance()
  return NextResponse.json({ success: true, config: getConfig(), logFilter: engine.getLogFilter() })
}
