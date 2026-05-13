import { ServerTCP } from 'modbus-serial';
import { ModbusEngine } from './engine';

const g = globalThis as typeof globalThis & {
  __modbus_tcp_server__?: ServerTCP | null;
  __modbus_tcp_running__?: boolean;
  __modbus_tcp_port__?: number;
};

/** Active TCP server instance, or null when stopped. */
let server: ServerTCP | null = g.__modbus_tcp_server__ ?? null;
/** Whether the server is currently accepting connections. */
let isRunning: boolean = g.__modbus_tcp_running__ ?? false;
/** Port the server was most recently started on. */
let currentPort: number = g.__modbus_tcp_port__ ?? 502;

/**
 * Starts a Modbus TCP server backed by the singleton ModbusEngine.
 * If the server is already running the existing instance is returned.
 *
 * @param port – TCP port to listen on (default 502).
 * @returns The started ServerTCP instance.
 */
export function startTCPServer(port?: number): ServerTCP {
  if (server) {
    return server;
  }
  currentPort = port ?? (Number(process.env.MODBUS_TCP_PORT) || 502);

  const engine = ModbusEngine.getInstance();

  const vector = {
    getCoil(addr: number, _unitID: number, callback: (err: Error | null, value: boolean) => void) {
      try {
        callback(null, engine.readCoil(addr));
      } catch (e) {
        engine.addErrorLog('coil', addr, (e as Error).message);
        callback(e as Error, false);
      }
    },
    getCoils(
      addr: number,
      length: number,
      _unitID: number,
      callback: (err: Error | null, values: boolean[]) => void,
    ) {
      try {
        callback(null, engine.readCoils(addr, length));
      } catch (e) {
        engine.addErrorLog('coil', addr, (e as Error).message);
        callback(e as Error, []);
      }
    },
    getDiscreteInput(
      addr: number,
      _unitID: number,
      callback: (err: Error | null, value: boolean) => void,
    ) {
      try {
        callback(null, engine.readDiscreteInput(addr));
      } catch (e) {
        engine.addErrorLog('discreteInput', addr, (e as Error).message);
        callback(e as Error, false);
      }
    },
    getDiscreteInputs(
      addr: number,
      length: number,
      _unitID: number,
      callback: (err: Error | null, values: boolean[]) => void,
    ) {
      try {
        callback(null, engine.readDiscreteInputs(addr, length));
      } catch (e) {
        engine.addErrorLog('discreteInput', addr, (e as Error).message);
        callback(e as Error, []);
      }
    },
    getInputRegister(
      addr: number,
      _unitID: number,
      callback: (err: Error | null, value: number) => void,
    ) {
      try {
        callback(null, engine.readInputRegister(addr));
      } catch (e) {
        engine.addErrorLog('inputRegister', addr, (e as Error).message);
        callback(e as Error, 0);
      }
    },
    getInputRegisters(
      addr: number,
      length: number,
      _unitID: number,
      callback: (err: Error | null, values: number[]) => void,
    ) {
      try {
        callback(null, engine.readInputRegisters(addr, length));
      } catch (e) {
        engine.addErrorLog('inputRegister', addr, (e as Error).message);
        callback(e as Error, []);
      }
    },
    getHoldingRegister(
      addr: number,
      _unitID: number,
      callback: (err: Error | null, value: number) => void,
    ) {
      try {
        callback(null, engine.readHoldingRegister(addr));
      } catch (e) {
        engine.addErrorLog('holdingRegister', addr, (e as Error).message);
        callback(e as Error, 0);
      }
    },
    getHoldingRegisters(
      addr: number,
      length: number,
      _unitID: number,
      callback: (err: Error | null, values: number[]) => void,
    ) {
      try {
        callback(null, engine.readHoldingRegisters(addr, length));
      } catch (e) {
        engine.addErrorLog('holdingRegister', addr, (e as Error).message);
        callback(e as Error, []);
      }
    },
    setCoil(addr: number, value: boolean, _unitID: number, callback: (err: Error | null) => void) {
      try {
        engine.writeCoil(addr, value);
        callback(null);
      } catch (e) {
        engine.addErrorLog('coil', addr, (e as Error).message);
        callback(e as Error);
      }
    },
    setRegister(
      addr: number,
      value: number,
      _unitID: number,
      callback: (err: Error | null) => void,
    ) {
      try {
        engine.writeHoldingRegister(addr, value);
        callback(null);
      } catch (e) {
        engine.addErrorLog('holdingRegister', addr, (e as Error).message);
        callback(e as Error);
      }
    },
  };

  server = new ServerTCP(vector, { host: '0.0.0.0', port, debug: false, unitID: 1 });
  isRunning = true;
  g.__modbus_tcp_server__ = server;
  g.__modbus_tcp_running__ = true;
  g.__modbus_tcp_port__ = port;

  server.on('serverError', (err: Error) => {
    console.error('Modbus TCP Server error:', err.message);
  });

  console.log(`Modbus TCP Server started on port ${port}`);
  return server;
}

/** Stops and clears the active TCP server, if any. */
export function stopTCPServer(): void {
  if (server) {
    isRunning = false;
    g.__modbus_tcp_running__ = false;
    server.close();
    server = null;
    g.__modbus_tcp_server__ = null;
    console.log('Modbus TCP Server stopped');
  }
}

/** @returns Whether the TCP server is currently running. */
export function isTCPServerRunning(): boolean {
  return isRunning;
}

/** @returns The port the TCP server was most recently started on. */
export function getTCPPort(): number {
  return currentPort;
}
