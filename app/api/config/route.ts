import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setConfig, restartServers, ensureServersStarted } from '@/src/lib/modbus';

ensureServersStarted();

export async function GET() {
  const config = getConfig();
  return NextResponse.json(config);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const updates: {
    tcpPort?: number;
    rtuSerialPath?: string | null;
    rtuBaudRate?: number;
    rtuParity?: 'none' | 'even' | 'odd';
    rtuDataBits?: number;
    rtuStopBits?: number;
  } = {};

  if (body.tcpPort !== undefined) {
    const port = Number(body.tcpPort);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      return NextResponse.json({ error: 'Invalid TCP port' }, { status: 400 });
    }
    updates.tcpPort = port;
  }

  if (body.rtuSerialPath !== undefined) {
    updates.rtuSerialPath =
      body.rtuSerialPath === null || body.rtuSerialPath === '' ? null : String(body.rtuSerialPath);
  }

  if (body.rtuBaudRate !== undefined) {
    const br = Number(body.rtuBaudRate);
    if (Number.isNaN(br) || br < 300 || br > 115200) {
      return NextResponse.json({ error: 'Invalid baud rate' }, { status: 400 });
    }
    updates.rtuBaudRate = br;
  }

  if (body.rtuParity !== undefined) {
    const p = String(body.rtuParity);
    if (!['none', 'even', 'odd'].includes(p)) {
      return NextResponse.json({ error: 'Invalid parity' }, { status: 400 });
    }
    updates.rtuParity = p as 'none' | 'even' | 'odd';
  }

  if (body.rtuDataBits !== undefined) {
    const db = Number(body.rtuDataBits);
    if (![5, 6, 7, 8].includes(db)) {
      return NextResponse.json({ error: 'Invalid data bits' }, { status: 400 });
    }
    updates.rtuDataBits = db;
  }

  if (body.rtuStopBits !== undefined) {
    const sb = Number(body.rtuStopBits);
    if (![1, 2].includes(sb)) {
      return NextResponse.json({ error: 'Invalid stop bits' }, { status: 400 });
    }
    updates.rtuStopBits = sb;
  }

  setConfig(updates);
  restartServers();

  return NextResponse.json({ success: true, config: getConfig() });
}
