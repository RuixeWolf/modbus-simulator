import { NextResponse } from 'next/server';
import { ModbusEngine } from '@/src/lib/modbus/engine';
import { ensureServersStarted } from '@/src/lib/modbus';

ensureServersStarted();

export async function GET() {
  const engine = ModbusEngine.getInstance();
  return NextResponse.json(engine.getLogs());
}
