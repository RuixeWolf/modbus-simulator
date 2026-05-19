import { NextRequest, NextResponse } from 'next/server'
import {
  ensureServersStarted,
  getConfig,
  isRTUSerialServerRunning,
  isTCPServerRunning,
  restartServers,
  setConfig
} from '@/src/lib/modbus'
import { ModbusEngine } from '@/src/lib/modbus/engine'

export const dynamic = 'force-dynamic'

ensureServersStarted()

export async function GET() {
  const config = getConfig()
  const engine = ModbusEngine.getInstance()
  return NextResponse.json({ ...config, logFilter: engine.getLogFilter() })
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const updates: {
    tcpEnabled?: boolean
    tcpPort?: number
    slaveId?: number
    rtuEnabled?: boolean
    rtuSerialPath?: string | null
    rtuBaudRate?: number
    rtuParity?: 'none' | 'even' | 'odd'
    rtuDataBits?: number
    rtuStopBits?: number
  } = {}

  if (body.tcpEnabled !== undefined) {
    if (typeof body.tcpEnabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid tcpEnabled (must be boolean)' }, { status: 400 })
    }
    updates.tcpEnabled = body.tcpEnabled
  }

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

  if (body.rtuEnabled !== undefined) {
    if (typeof body.rtuEnabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid rtuEnabled (must be boolean)' }, { status: 400 })
    }
    updates.rtuEnabled = body.rtuEnabled
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

  if (body.logFilter !== undefined) {
    if (
      body.logFilter === null ||
      typeof body.logFilter !== 'object' ||
      typeof body.logFilter.read !== 'boolean' ||
      typeof body.logFilter.write !== 'boolean' ||
      typeof body.logFilter.error !== 'boolean'
    ) {
      return NextResponse.json(
        { error: 'Invalid logFilter (must be object with boolean read/write/error fields)' },
        { status: 400 }
      )
    }
    const engine = ModbusEngine.getInstance()
    engine.setLogFilter({
      read: body.logFilter.read,
      write: body.logFilter.write,
      error: body.logFilter.error
    })
  }

  const currentConfig = getConfig()
  setConfig(updates)

  // Only restart servers when server-relevant config fields actually changed
  const serverFields: (keyof typeof updates)[] = [
    'tcpEnabled',
    'tcpPort',
    'slaveId',
    'rtuEnabled',
    'rtuSerialPath',
    'rtuBaudRate',
    'rtuParity',
    'rtuDataBits',
    'rtuStopBits'
  ]
  const shouldRestart = serverFields.some(
    (field) => field in updates && updates[field] !== currentConfig[field]
  )
  if (shouldRestart) {
    await restartServers()

    // Poll until expected servers are in the correct state (max 5s)
    const newConfig = getConfig()
    const expectTcp = newConfig.tcpEnabled
    const expectRtu = newConfig.rtuEnabled && newConfig.rtuSerialPath !== null
    const maxWaitMs = 5000
    const pollIntervalMs = 200
    const start = Date.now()

    while (Date.now() - start < maxWaitMs) {
      const tcpReady = expectTcp ? isTCPServerRunning() : !isTCPServerRunning()
      const rtuReady = expectRtu ? isRTUSerialServerRunning() : !isRTUSerialServerRunning()
      if (tcpReady && rtuReady) break
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }
  }

  const engine = ModbusEngine.getInstance()
  return NextResponse.json({ success: true, config: getConfig(), logFilter: engine.getLogFilter() })
}
