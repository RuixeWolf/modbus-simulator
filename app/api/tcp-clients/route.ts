import { NextResponse } from 'next/server'
import { disconnectAllTCPClients, ensureServersStarted, getTCPClients } from '@/src/lib/modbus'

export const dynamic = 'force-dynamic'

ensureServersStarted()

export async function GET() {
  return NextResponse.json({ clients: getTCPClients() })
}

export async function DELETE() {
  const disconnected = disconnectAllTCPClients()
  return NextResponse.json({ disconnected })
}
