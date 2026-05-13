import { NextResponse } from 'next/server';
import {
  isTCPServerRunning,
  isRTUSerialServerRunning,
  ensureServersStarted,
} from '@/src/lib/modbus';

ensureServersStarted();

export async function GET() {
  return NextResponse.json({
    tcp: isTCPServerRunning(),
    rtu: isRTUSerialServerRunning(),
  });
}
