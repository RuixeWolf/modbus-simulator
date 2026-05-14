import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModbusEngine } from './engine'

describe('ModbusEngine', () => {
  beforeEach(() => {
    ModbusEngine.resetInstance()
  })

  it('should be a singleton', () => {
    const a = ModbusEngine.getInstance()
    const b = ModbusEngine.getInstance()
    expect(a).toBe(b)
  })

  it('should read and write coils', () => {
    const engine = ModbusEngine.getInstance()
    expect(engine.readCoil(0)).toBe(false)
    engine.writeCoil(0, true)
    expect(engine.readCoil(0)).toBe(true)
  })

  it('should read and write holding registers', () => {
    const engine = ModbusEngine.getInstance()
    expect(engine.readHoldingRegister(0)).toBe(0)
    engine.writeHoldingRegister(0, 1234)
    expect(engine.readHoldingRegister(0)).toBe(1234)
  })

  it('should clamp register values to 16-bit', () => {
    const engine = ModbusEngine.getInstance()
    engine.writeHoldingRegister(0, 70000)
    expect(engine.readHoldingRegister(0)).toBe(70000 & 0xffff)
  })

  it('should throw on out-of-range coil access', () => {
    const engine = ModbusEngine.getInstance()
    expect(() => engine.readCoil(-1)).toThrow()
    expect(() => engine.readCoil(10000)).toThrow()
  })

  it('should emit change events', () => {
    const engine = ModbusEngine.getInstance()
    const handler = vi.fn()
    engine.on('change', handler)
    engine.writeCoil(5, true)
    expect(handler).toHaveBeenCalledWith({
      registerType: 'coil',
      address: 5,
      value: true
    })
  })

  it('should maintain logs', () => {
    const engine = ModbusEngine.getInstance()
    engine.writeHoldingRegister(0, 42)
    const logs = engine.getLogs()
    expect(logs.length).toBeGreaterThan(0)
    expect(logs[logs.length - 1].type).toBe('write')
    expect(logs[logs.length - 1].registerType).toBe('holdingRegister')
  })

  it('should read multiple coils', () => {
    const engine = ModbusEngine.getInstance()
    engine.writeCoil(0, true)
    engine.writeCoil(1, false)
    engine.writeCoil(2, true)
    const result = engine.readCoils(0, 3)
    expect(result).toEqual([true, false, true])
  })

  it('should read multiple holding registers', () => {
    const engine = ModbusEngine.getInstance()
    engine.writeHoldingRegister(0, 10)
    engine.writeHoldingRegister(1, 20)
    engine.writeHoldingRegister(2, 30)
    const result = engine.readHoldingRegisters(0, 3)
    expect(result).toEqual([10, 20, 30])
  })
})
