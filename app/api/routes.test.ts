import { describe, expect, it, vi } from 'vitest'

// Mock modbus modules before importing route handlers
vi.mock('@/src/lib/modbus', () => ({
  ensureServersStarted: vi.fn(),
  getConfig: vi.fn().mockReturnValue({
    tcpEnabled: true,
    tcpPort: 502,
    slaveId: 1,
    rtuEnabled: true,
    rtuSerialPath: null,
    rtuBaudRate: 9600,
    rtuParity: 'none',
    rtuDataBits: 8,
    rtuStopBits: 1
  }),
  setConfig: vi.fn(),
  restartServers: vi.fn().mockResolvedValue(undefined),
  isTCPServerRunning: vi.fn().mockReturnValue(true),
  isRTUSerialServerRunning: vi.fn().mockReturnValue(false)
}))

vi.mock('@/src/lib/modbus/engine', () => {
  const logs: {
    timestamp: string
    type: string
    registerType: string
    address: number
    value?: number
  }[] = []
  return {
    ModbusEngine: {
      getInstance: vi.fn().mockReturnValue({
        getState: vi.fn().mockReturnValue({
          coils: [true, false],
          discreteInputs: [false, true],
          holdingRegisters: [100, 200],
          inputRegisters: [300, 400]
        }),
        getLogs: vi.fn().mockReturnValue(logs),
        clearLogs: vi.fn().mockImplementation(() => {
          logs.length = 0
        }),
        writeHoldingRegister: vi.fn(),
        writeCoil: vi.fn(),
        writeInputRegister: vi.fn(),
        writeDiscreteInput: vi.fn(),
        addErrorLog: vi.fn(),
        getLogFilter: vi.fn().mockReturnValue({ read: true, write: true, error: true }),
        setLogFilter: vi.fn()
      })
    }
  }
})

vi.mock('serialport', () => ({
  SerialPort: {
    list: vi.fn().mockResolvedValue([
      { path: 'COM1', manufacturer: 'Mock', serialNumber: '123' },
      { path: 'COM2', manufacturer: undefined, serialNumber: undefined }
    ])
  }
}))

function createMockRequest(body: object): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

describe('API Routes', () => {
  describe('GET /api/registers', () => {
    it('should return engine state', async () => {
      const { GET } = await import('./registers/route')
      const res = await GET()
      const data = await res.json()
      expect(data).toEqual({
        coils: [true, false],
        discreteInputs: [false, true],
        holdingRegisters: [100, 200],
        inputRegisters: [300, 400]
      })
    })
  })

  describe('POST /api/registers', () => {
    it('should write holding register', async () => {
      const { POST } = await import('./registers/route')
      const req = createMockRequest({ registerType: 'holdingRegister', address: 0, value: 1234 })
      const res = await POST(req as unknown as import('next/server').NextRequest)
      const data = await res.json()
      expect(data.success).toBe(true)
    })

    it('should write coil', async () => {
      const { POST } = await import('./registers/route')
      const req = createMockRequest({ registerType: 'coil', address: 0, value: true })
      const res = await POST(req as unknown as import('next/server').NextRequest)
      const data = await res.json()
      expect(data.success).toBe(true)
    })

    it('should reject unsupported register type', async () => {
      const { POST } = await import('./registers/route')
      const req = createMockRequest({ registerType: 'invalid', address: 0, value: 1 })
      const res = await POST(req as unknown as import('next/server').NextRequest)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Unsupported register type')
    })
  })

  describe('GET /api/logs', () => {
    it('should return logs', async () => {
      const { GET } = await import('./logs/route')
      const res = await GET()
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('DELETE /api/logs', () => {
    it('should clear logs', async () => {
      const { DELETE } = await import('./logs/route')
      const res = await DELETE()
      const data = await res.json()
      expect(data.success).toBe(true)
    })
  })

  describe('GET /api/status', () => {
    it('should return server status', async () => {
      const { GET } = await import('./status/route')
      const res = await GET()
      const data = await res.json()
      expect(data).toEqual({ tcp: true, rtu: false })
    })
  })

  describe('GET /api/config', () => {
    it('should return current config', async () => {
      const { GET } = await import('./config/route')
      const res = await GET()
      const data = await res.json()
      expect(data.tcpPort).toBe(502)
      expect(data.slaveId).toBe(1)
    })
  })

  describe('POST /api/config', () => {
    it('should update TCP port', async () => {
      const { POST } = await import('./config/route')
      const { setConfig, restartServers } = await import('@/src/lib/modbus')
      const req = createMockRequest({ tcpPort: 1502 })
      const res = await POST(req as unknown as import('next/server').NextRequest)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(setConfig).toHaveBeenCalledWith(expect.objectContaining({ tcpPort: 1502 }))
      expect(restartServers).toHaveBeenCalled()
    })

    it('should reject invalid slave ID', async () => {
      const { POST } = await import('./config/route')
      const req = createMockRequest({ slaveId: 0 })
      const res = await POST(req as unknown as import('next/server').NextRequest)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('Invalid slave ID')
    })

    it('should reject invalid TCP port', async () => {
      const { POST } = await import('./config/route')
      const req = createMockRequest({ tcpPort: 70000 })
      const res = await POST(req as unknown as import('next/server').NextRequest)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid TCP port')
    })

    it('should update log filter', async () => {
      const { POST } = await import('./config/route')
      const req = createMockRequest({ logFilter: { read: false, write: true, error: true } })
      const res = await POST(req as unknown as import('next/server').NextRequest)
      const data = await res.json()
      expect(data.success).toBe(true)
    })
  })

  describe('GET /api/serial-ports', () => {
    it('should return serial ports', async () => {
      const { GET } = await import('./serial-ports/route')
      const res = await GET()
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(2)
      expect(data[0].path).toBe('COM1')
      expect(data[1].path).toBe('COM2')
    })
  })
})
