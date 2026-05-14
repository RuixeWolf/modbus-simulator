import { SerialPort } from 'serialport'
import { ModbusEngine } from './engine'

/** Serial port configuration parameters. */
export interface SerialConfig {
  /** Baud rate in bps (default 9600). */
  baudRate: number
  /** Parity: none, even, or odd (default none). */
  parity: 'none' | 'even' | 'odd'
  /** Data bits: 5-8 (default 8). */
  dataBits: number
  /** Stop bits: 1 or 2 (default 1). */
  stopBits: number
  /** Modbus slave ID / device address (default 1, range 1-247). */
  slaveId?: number
}

/** CRC16-IBM checksum used by Modbus RTU frames. */
function crc16(buffer: Buffer): number {
  let crc = 0xffff
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i]
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1
    }
  }
  return crc
}

/**
 * @param frame – Raw RTU frame including trailing CRC bytes.
 * @returns Whether the frame's embedded CRC matches the computed checksum.
 */
function verifyCRC(frame: Buffer): boolean {
  if (frame.length < 4) return false
  const data = frame.slice(0, -2)
  const receivedCRC = frame.readUInt16LE(frame.length - 2)
  return crc16(data) === receivedCRC
}

/**
 * Computes and appends the CRC16 trailer to a data buffer.
 * @param data – Payload without CRC (slave ID + function code + data).
 * @returns New buffer with two CRC bytes appended at the end.
 */
function appendCRC(data: Buffer): Buffer {
  const crc = crc16(data)
  const result = Buffer.alloc(data.length + 2)
  data.copy(result)
  result.writeUInt16LE(crc, data.length)
  return result
}

/** Active SerialPort instance, or null when stopped. */
let serialPort: SerialPort | null = null
/** Whether the serial server is currently open and listening. */
let isRunning = false
/** Path of the serial port the server was most recently started on. */
let currentPath = ''
/** Accumulated raw bytes between frame timeouts. */
let buffer = Buffer.alloc(0)
/** Active silence-timeout timer used for frame delimiting. */
let timer: NodeJS.Timeout | null = null

/**
 * Computes the inter-frame silence timeout based on baud rate.
 * Modbus RTU requires 3.5 character times of silence to mark a frame end.
 * @param baudRate – Serial baud rate in bps.
 * @returns Timeout in milliseconds (minimum 5 ms).
 */
function computeFrameTimeout(baudRate: number): number {
  // 3.5 characters * (1 start + 8 data + 1 parity + 1 stop) bits / baudRate
  // Using 11 bits as a safe upper bound for typical 8N1/8E1 configs
  const ms = Math.ceil((3.5 * 11 * 1000) / baudRate)
  return Math.max(ms, 5)
}

/**
 * Parses a complete RTU frame and dispatches it to the ModbusEngine.
 *
 * @param frame    – Verified RTU frame (slave ID + function code + data + CRC).
 * @param engine   – Singleton register engine to read from or write into.
 * @param slaveId  – Expected Modbus slave ID (default 1).
 * @returns RTU response frame with updated CRC, or null when the slave ID does not match.
 */
function processFrame(frame: Buffer, engine: ModbusEngine, slaveId: number): Buffer | null {
  if (frame[0] !== slaveId) return null

  const funcCode = frame[1]

  // Minimum frame length validation based on function code
  // 0x01-0x06: slaveID(1) + func(1) + addr(2) + count/value(2) + CRC(2) = 8 bytes
  // 0x0F/0x10: slaveID(1) + func(1) + addr(2) + quantity(2) + byteCount(1) + data + CRC(2) >= 9 bytes
  const minLengths: Record<number, number> = {
    0x01: 8,
    0x02: 8,
    0x03: 8,
    0x04: 8,
    0x05: 8,
    0x06: 8,
    0x0f: 9,
    0x10: 9
  }

  if (minLengths[funcCode] !== undefined && frame.length < minLengths[funcCode]) {
    engine.addErrorLog(
      'rtu',
      0,
      `RTU frame too short for FC 0x${funcCode.toString(16)}: ${frame.length} bytes`
    )
    return Buffer.from([slaveId, funcCode | 0x80, 0x03])
  }

  let responseData: Buffer

  try {
    switch (funcCode) {
      case 0x01: {
        // Read Coils
        const address = frame.readUInt16BE(2)
        const count = frame.readUInt16BE(4)
        const coils = engine.readCoils(address, count)
        const byteCount = Math.ceil(count / 8)
        responseData = Buffer.alloc(1 + byteCount)
        responseData[0] = byteCount
        for (let i = 0; i < count; i++) {
          if (coils[i]) {
            responseData[1 + Math.floor(i / 8)] |= 1 << (i % 8)
          }
        }
        break
      }
      case 0x02: {
        // Read Discrete Inputs
        const address = frame.readUInt16BE(2)
        const count = frame.readUInt16BE(4)
        const inputs = engine.readDiscreteInputs(address, count)
        const byteCount = Math.ceil(count / 8)
        responseData = Buffer.alloc(1 + byteCount)
        responseData[0] = byteCount
        for (let i = 0; i < count; i++) {
          if (inputs[i]) {
            responseData[1 + Math.floor(i / 8)] |= 1 << (i % 8)
          }
        }
        break
      }
      case 0x03: {
        // Read Holding Registers
        const address = frame.readUInt16BE(2)
        const count = frame.readUInt16BE(4)
        const regs = engine.readHoldingRegisters(address, count)
        responseData = Buffer.alloc(1 + count * 2)
        responseData[0] = count * 2
        for (let i = 0; i < count; i++) {
          responseData.writeUInt16BE(regs[i], 1 + i * 2)
        }
        break
      }
      case 0x04: {
        // Read Input Registers
        const address = frame.readUInt16BE(2)
        const count = frame.readUInt16BE(4)
        const regs = engine.readInputRegisters(address, count)
        responseData = Buffer.alloc(1 + count * 2)
        responseData[0] = count * 2
        for (let i = 0; i < count; i++) {
          responseData.writeUInt16BE(regs[i], 1 + i * 2)
        }
        break
      }
      case 0x05: {
        // Write Single Coil
        const address = frame.readUInt16BE(2)
        const value = frame.readUInt16BE(4)
        engine.writeCoil(address, value === 0xff00)
        responseData = Buffer.alloc(4)
        responseData.writeUInt16BE(address, 0)
        responseData.writeUInt16BE(value, 2)
        break
      }
      case 0x06: {
        // Write Single Register
        const address = frame.readUInt16BE(2)
        const value = frame.readUInt16BE(4)
        engine.writeHoldingRegister(address, value)
        responseData = Buffer.alloc(4)
        responseData.writeUInt16BE(address, 0)
        responseData.writeUInt16BE(value, 2)
        break
      }
      case 0x0f: {
        // Write Multiple Coils
        const address = frame.readUInt16BE(2)
        const quantity = frame.readUInt16BE(4)
        const byteCount = frame[6]
        if (frame.length !== 9 + byteCount) {
          engine.addErrorLog(
            'rtu',
            address,
            `FC 0x0F frame length mismatch: expected ${9 + byteCount}, got ${frame.length}`
          )
          return Buffer.from([slaveId, funcCode | 0x80, 0x03])
        }
        for (let i = 0; i < quantity; i++) {
          const byteIndex = Math.floor(i / 8)
          const bitMask = 1 << (i % 8)
          const coilValue = (frame[7 + byteIndex] & bitMask) !== 0
          engine.writeCoil(address + i, coilValue)
        }
        responseData = Buffer.alloc(4)
        responseData.writeUInt16BE(address, 0)
        responseData.writeUInt16BE(quantity, 2)
        break
      }
      case 0x10: {
        // Write Multiple Registers
        const address = frame.readUInt16BE(2)
        const quantity = frame.readUInt16BE(4)
        const byteCount = frame[6]
        if (frame.length !== 9 + byteCount) {
          engine.addErrorLog(
            'rtu',
            address,
            `FC 0x10 frame length mismatch: expected ${9 + byteCount}, got ${frame.length}`
          )
          return Buffer.from([slaveId, funcCode | 0x80, 0x03])
        }
        for (let i = 0; i < quantity; i++) {
          const regValue = frame.readUInt16BE(7 + i * 2)
          engine.writeHoldingRegister(address + i, regValue)
        }
        responseData = Buffer.alloc(4)
        responseData.writeUInt16BE(address, 0)
        responseData.writeUInt16BE(quantity, 2)
        break
      }
      default:
        // Exception: illegal function
        return Buffer.from([slaveId, funcCode | 0x80, 0x01])
    }

    const response = Buffer.concat([Buffer.from([slaveId, funcCode]), responseData])
    return appendCRC(response)
  } catch (e) {
    const errorCode = (e as Error).message.includes('out of range') ? 0x02 : 0x04
    return Buffer.from([slaveId, funcCode | 0x80, errorCode])
  }
}

/**
 * Opens a real serial port and listens for Modbus RTU frames.
 * Frames are delimited by a silence timeout and validated with CRC16.
 *
 * @param serialPath – OS path to the serial port (e.g. "COM1" or "/dev/ttyUSB0").
 * @param serialConfig – Serial port parameters (baud rate, parity, data bits, stop bits).
 */
export function startRTUSerialServer(
  serialPath: string,
  serialConfig: SerialConfig = { baudRate: 9600, parity: 'none', dataBits: 8, stopBits: 1 }
): void {
  if (serialPort) {
    return
  }

  const engine = ModbusEngine.getInstance()
  currentPath = serialPath
  const slaveId = serialConfig.slaveId ?? 1
  const frameTimeoutMs = computeFrameTimeout(serialConfig.baudRate)

  try {
    serialPort = new SerialPort({
      path: serialPath,
      baudRate: serialConfig.baudRate,
      parity: serialConfig.parity,
      dataBits: serialConfig.dataBits,
      stopBits: serialConfig.stopBits
    })
    isRunning = true

    serialPort.on('data', (data: Buffer) => {
      buffer = Buffer.concat([buffer, data])
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (buffer.length < 4) {
          buffer = Buffer.alloc(0)
          return
        }

        if (!verifyCRC(buffer)) {
          console.warn('RTU Serial: Invalid CRC, discarding frame')
          buffer = Buffer.alloc(0)
          return
        }

        const response = processFrame(buffer, engine, slaveId)
        buffer = Buffer.alloc(0)

        if (response && serialPort) {
          serialPort.write(response)
        }
      }, frameTimeoutMs)
    })

    serialPort.on('error', (err: Error) => {
      console.error('Modbus RTU Serial Server error:', err.message)
      engine.addErrorLog('rtu', 0, err.message)
      isRunning = false
      serialPort = null
    })

    serialPort.on('open', () => {
      console.log(
        `Modbus RTU Serial Server started on ${serialPath} ` +
          `(${serialConfig.baudRate}/${serialConfig.dataBits}-${serialConfig.parity.charAt(0).toUpperCase()}-${serialConfig.stopBits}, slave ID ${slaveId})`
      )
    })

    serialPort.on('close', () => {
      console.log(`Modbus RTU Serial Server closed on ${serialPath}`)
      isRunning = false
      serialPort = null
    })
  } catch (e) {
    console.error('Failed to start Modbus RTU Serial Server:', (e as Error).message)
    engine.addErrorLog('rtu', 0, (e as Error).message)
    isRunning = false
    serialPort = null
  }
}

/** Closes the serial port and clears frame buffers. */
export function stopRTUSerialServer(): void {
  if (serialPort) {
    isRunning = false
    serialPort.close()
    serialPort = null
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    buffer = Buffer.alloc(0)
    console.log('Modbus RTU Serial Server stopped')
  }
}

/** @returns Whether the RTU serial server is currently running. */
export function isRTUSerialServerRunning(): boolean {
  return isRunning
}

/** @returns The serial port path the RTU server was most recently started on. */
export function getRTUSerialPath(): string {
  return currentPath
}
