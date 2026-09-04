import { beforeEach, describe, expect, it } from 'vitest'
import { MODBUS_TABLE, ModbusEngine } from '../engine'
import { CONTROL_ERROR_CODE, ControlError } from './errors'
import { controlService } from './service'

describe('control service register operations', () => {
  beforeEach(() => ModbusEngine.resetInstance())

  it('writes encoded values with existing public data type names and byte orders', () => {
    const result = controlService.writeEncoded(MODBUS_TABLE.HOLDING_REGISTERS, {
      address: 0,
      dataType: 'Float3412',
      value: 1
    })
    expect(result.count).toBe(2)
    expect(
      controlService.readRange(MODBUS_TABLE.HOLDING_REGISTERS, { start: 0, count: 2 }).values
    ).toEqual(result.values)

    expect(
      controlService.writeEncoded(MODBUS_TABLE.INPUT_REGISTERS, {
        address: 5,
        bytes: '12 34 AB CD'
      }).values
    ).toEqual([0x1234, 0xabcd])
  })

  it('rejects overflow, malformed bytes, bit tables and boundary failures atomically', () => {
    expect(() =>
      controlService.writeEncoded(MODBUS_TABLE.HOLDING_REGISTERS, {
        address: 0,
        dataType: 'UInt8',
        value: 256
      })
    ).toThrow(ControlError)
    expect(() =>
      controlService.writeEncoded(MODBUS_TABLE.HOLDING_REGISTERS, {
        address: 0,
        bytes: 'AA'
      })
    ).toThrow(ControlError)
    let bitTableError: unknown
    try {
      controlService.writeEncoded(MODBUS_TABLE.COILS, {
        address: 0,
        dataType: 'UInt16BE',
        value: 1
      })
    } catch (error) {
      bitTableError = error
    }
    expect(bitTableError).toMatchObject({ code: CONTROL_ERROR_CODE.NOT_FOUND })
    expect(() =>
      controlService.writeEncoded(MODBUS_TABLE.HOLDING_REGISTERS, {
        address: 9999,
        dataType: 'UInt32BE',
        value: 1
      })
    ).toThrow(ControlError)
    expect(ModbusEngine.getInstance().getState().holdingRegisters[9999]).toBe(0)
  })
})
