import { SerialPort } from 'serialport'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getRTUSerialPath,
  isRTUSerialServerRunning,
  startRTUSerialServer,
  stopRTUSerialServer
} from './rtu-serial-server'

let mockOpen = false
let dataHandler: ((data: Buffer) => void) | null = null
let _errorHandler: ((err: Error) => void) | null = null
let openHandler: (() => void) | null = null
let closeHandler: (() => void) | null = null

function createMockSerialPort() {
  return {
    get isOpen() {
      return mockOpen
    },
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'data') dataHandler = cb as (data: Buffer) => void
      if (event === 'error') _errorHandler = cb as (err: Error) => void
      if (event === 'open') openHandler = cb as () => void
      if (event === 'close') closeHandler = cb as () => void
    }),
    write: vi.fn(),
    close: vi.fn((cb?: (err?: Error) => void) => {
      mockOpen = false
      if (cb) cb()
      if (closeHandler) closeHandler()
    }),
    removeAllListeners: vi.fn()
  }
}

let mockPort = createMockSerialPort()

vi.mock('serialport', () => ({
  SerialPort: vi.fn(function SerialPort() {
    mockPort = createMockSerialPort()
    mockOpen = true
    setTimeout(() => {
      if (openHandler) openHandler()
    }, 0)
    return mockPort
  })
}))

describe('rtu-serial-server', () => {
  beforeEach(async () => {
    await stopRTUSerialServer()
    mockOpen = false
    dataHandler = null
    _errorHandler = null
    openHandler = null
    closeHandler = null
    vi.clearAllMocks()
  })

  it('should start RTU serial server on given path', async () => {
    startRTUSerialServer('COM3')
    // Wait for the open event to fire asynchronously
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(isRTUSerialServerRunning()).toBe(true)
    expect(getRTUSerialPath()).toBe('COM3')
  })

  it('should not start a second server if already running', async () => {
    startRTUSerialServer('COM3')
    await new Promise((resolve) => setTimeout(resolve, 10))
    const first = mockPort
    startRTUSerialServer('COM4')
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(getRTUSerialPath()).toBe('COM3')
    expect(mockPort).toBe(first)
  })

  it('should report not running after stop', async () => {
    startRTUSerialServer('COM3')
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(isRTUSerialServerRunning()).toBe(true)
    await stopRTUSerialServer()
    expect(isRTUSerialServerRunning()).toBe(false)
  })

  it('should stop idempotently', async () => {
    await stopRTUSerialServer()
    expect(isRTUSerialServerRunning()).toBe(false)
  })

  it('should use default serial config', () => {
    startRTUSerialServer('/dev/ttyUSB0')
    expect(SerialPort).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/dev/ttyUSB0',
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1
      })
    )
  })

  it('should use custom serial config', () => {
    startRTUSerialServer('COM1', {
      baudRate: 115200,
      parity: 'even',
      dataBits: 7,
      stopBits: 2,
      slaveId: 5
    })
    expect(SerialPort).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'COM1',
        baudRate: 115200,
        parity: 'even',
        dataBits: 7,
        stopBits: 2
      })
    )
  })

  it('should process valid Modbus RTU read frame', async () => {
    const { ModbusEngine } = await import('./engine')
    ModbusEngine.resetInstance()
    const engine = ModbusEngine.getInstance()
    engine.writeHoldingRegister(0, 0x1234)

    startRTUSerialServer('COM3', {
      baudRate: 9600,
      parity: 'none',
      dataBits: 8,
      stopBits: 1,
      slaveId: 1
    })
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Build a valid RTU frame: slaveID=1, FC=0x03, addr=0, count=1 + CRC
    const frame = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
    let crc = 0xffff
    for (let i = 0; i < frame.length; i++) {
      crc ^= frame[i]
      for (let j = 0; j < 8; j++) {
        crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1
      }
    }
    const frameWithCrc = Buffer.alloc(frame.length + 2)
    frame.copy(frameWithCrc)
    frameWithCrc.writeUInt16LE(crc, frame.length)

    if (dataHandler) {
      dataHandler(frameWithCrc)
    }

    // Wait for frame timeout (5ms at 9600 baud)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(mockPort.write).toHaveBeenCalled()
    const response = mockPort.write.mock.calls[0][0] as Buffer
    expect(response[0]).toBe(0x01) // slave ID
    expect(response[1]).toBe(0x03) // function code
    expect(response[2]).toBe(0x02) // byte count
    expect(response.readUInt16BE(3)).toBe(0x1234) // value
  })

  it('should ignore frames with wrong slave ID', async () => {
    startRTUSerialServer('COM3', {
      baudRate: 9600,
      parity: 'none',
      dataBits: 8,
      stopBits: 1,
      slaveId: 5
    })
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Frame with slaveID=1 but expected slaveID=5
    const frame = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
    let crc = 0xffff
    for (let i = 0; i < frame.length; i++) {
      crc ^= frame[i]
      for (let j = 0; j < 8; j++) {
        crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1
      }
    }
    const frameWithCrc = Buffer.alloc(frame.length + 2)
    frame.copy(frameWithCrc)
    frameWithCrc.writeUInt16LE(crc, frame.length)

    if (dataHandler) {
      dataHandler(frameWithCrc)
    }

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mockPort.write).not.toHaveBeenCalled()
  })
})
