import { NextResponse } from 'next/server'
import { disconnectTCPClient, ensureServersStarted } from '@/src/lib/modbus'

export const dynamic = 'force-dynamic'

ensureServersStarted()

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const clientId = Number(id)
  if (!Number.isInteger(clientId) || clientId < 1) {
    return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 })
  }
  const success = disconnectTCPClient(clientId)
  if (!success) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
