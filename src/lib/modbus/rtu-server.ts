import { ServerTCP } from 'modbus-serial'
import { ModbusEngine } from './engine'

/** Active RTU-over-TCP bridge server, or null when stopped. */
let server: ServerTCP | null = null
/** Whether the bridge server is currently running. */
let isRunning = false

/**
 * Starts an RTU-over-TCP bridge server (legacy TCP bridge on port 5021).
 * Prefer {@link startRTUSerialServer} for real serial-port RTU.
 *
 * @param port – TCP port to listen on (default 5021).
 * @returns The started ServerTCP instance.
 */
export function startRTUServer(port = 5021): ServerTCP {
  if (server) {
    return server
  }

  const engine = ModbusEngine.getInstance()

  const vector = {
    getCoil(addr: number, _unitID: number, callback: (err: Error | null, value: boolean) => void) {
      try {
        callback(null, engine.readCoil(addr))
      } catch (e) {
        engine.addErrorLog('coil', addr, (e as Error).message)
        callback(e as Error, false)
      }
    },
    getDiscreteInput(
      addr: number,
      _unitID: number,
      callback: (err: Error | null, value: boolean) => void
    ) {
      try {
        callback(null, engine.readDiscreteInput(addr))
      } catch (e) {
        engine.addErrorLog('discreteInput', addr, (e as Error).message)
        callback(e as Error, false)
      }
    },
    getInputRegister(
      addr: number,
      _unitID: number,
      callback: (err: Error | null, value: number) => void
    ) {
      try {
        callback(null, engine.readInputRegister(addr))
      } catch (e) {
        engine.addErrorLog('inputRegister', addr, (e as Error).message)
        callback(e as Error, 0)
      }
    },
    getHoldingRegister(
      addr: number,
      _unitID: number,
      callback: (err: Error | null, value: number) => void
    ) {
      try {
        callback(null, engine.readHoldingRegister(addr))
      } catch (e) {
        engine.addErrorLog('holdingRegister', addr, (e as Error).message)
        callback(e as Error, 0)
      }
    },
    setCoil(addr: number, value: boolean, _unitID: number, callback: (err: Error | null) => void) {
      try {
        engine.writeCoil(addr, value)
        callback(null)
      } catch (e) {
        engine.addErrorLog('coil', addr, (e as Error).message)
        callback(e as Error)
      }
    },
    setRegister(
      addr: number,
      value: number,
      _unitID: number,
      callback: (err: Error | null) => void
    ) {
      try {
        engine.writeHoldingRegister(addr, value)
        callback(null)
      } catch (e) {
        engine.addErrorLog('holdingRegister', addr, (e as Error).message)
        callback(e as Error)
      }
    }
  }

  server = new ServerTCP(vector, { host: '0.0.0.0', port, debug: false, unitID: 1 })
  isRunning = true

  server.on('serverError', (err: Error) => {
    console.error('Modbus RTU Server error:', err.message)
  })

  console.log(`Modbus RTU Server (TCP bridge) started on port ${port}`)
  return server
}

/** Stops the RTU-over-TCP bridge server, if running. */
export function stopRTUServer(): void {
  if (server) {
    isRunning = false
    server.close()
    server = null
    console.log('Modbus RTU Server stopped')
  }
}

/** @returns Whether the RTU bridge server is currently running. */
export function isRTUServerRunning(): boolean {
  return isRunning
}
