import { SerialPort } from 'serialport'
import { DATA_TYPES, numberToBuffer, parseHexString } from '../buffer-convert'
import type { DataType } from '../buffer-convert'
import {
  COIL_COUNT,
  DISCRETE_INPUT_COUNT,
  HOLDING_REGISTER_COUNT,
  INPUT_REGISTER_COUNT,
  MODBUS_TABLE,
  ModbusEngine
} from '../engine'
import type { ModbusTable } from '../engine'
import { getRuntimeCoordinator } from '../lifecycle'
import { disconnectAllTCPClients, disconnectTCPClient, getTCPClients } from '../tcp-server'
import { API_VERSION, PACKAGE_VERSION } from './constants'
import { CONTROL_ERROR_CODE, ControlError } from './errors'
import type { EncodedWrite, RangeQuery, ServerConfigPatch } from './schemas'

const TABLE_CAPACITY: Record<ModbusTable, number> = {
  [MODBUS_TABLE.COILS]: COIL_COUNT,
  [MODBUS_TABLE.DISCRETE_INPUTS]: DISCRETE_INPUT_COUNT,
  [MODBUS_TABLE.HOLDING_REGISTERS]: HOLDING_REGISTER_COUNT,
  [MODBUS_TABLE.INPUT_REGISTERS]: INPUT_REGISTER_COUNT
}

function assertBoundary(table: ModbusTable, start: number, count: number): void {
  if (start + count > TABLE_CAPACITY[table]) {
    throw new ControlError(CONTROL_ERROR_CODE.VALIDATION_ERROR, 'Request validation failed.', [
      { path: 'start', message: `Range exceeds ${table} capacity of ${TABLE_CAPACITY[table]}.` }
    ])
  }
}

export const controlService = {
  discovery() {
    return {
      apiVersion: API_VERSION,
      packageVersion: PACKAGE_VERSION,
      health: '/api/v1/health',
      openapi: '/api/v1/openapi.json'
    }
  },

  health() {
    return getRuntimeCoordinator().getHealth(PACKAGE_VERSION, API_VERSION)
  },

  state() {
    return ModbusEngine.getInstance().getState()
  },

  reset(tables?: readonly ModbusTable[], clearLogs = false) {
    ModbusEngine.getInstance().resetState(tables, clearLogs)
    return { resetTables: tables ?? Object.values(MODBUS_TABLE), logsCleared: clearLogs }
  },

  readRange(table: ModbusTable, query: RangeQuery) {
    assertBoundary(table, query.start, query.count)
    return {
      table,
      start: query.start,
      count: query.count,
      values: ModbusEngine.getInstance().readRange(table, query.start, query.count)
    }
  },

  writeRange(table: ModbusTable, start: number, values: readonly (boolean | number)[]) {
    assertBoundary(table, start, values.length)
    ModbusEngine.getInstance().writeRange(table, start, values)
    return { table, start, count: values.length }
  },

  writeEncoded(table: ModbusTable, request: EncodedWrite) {
    if (table !== MODBUS_TABLE.HOLDING_REGISTERS && table !== MODBUS_TABLE.INPUT_REGISTERS) {
      throw new ControlError(
        CONTROL_ERROR_CODE.NOT_FOUND,
        'Encoded writes are only available for register tables.'
      )
    }
    let buffer: Buffer
    try {
      if ('bytes' in request) {
        buffer = parseHexString(request.bytes)
        if (buffer.length === 0 || buffer.length % 2 !== 0) {
          throw new RangeError('Hex bytes must contain a non-empty even number of bytes.')
        }
      } else {
        if (!DATA_TYPES.includes(request.dataType as DataType))
          throw new RangeError('Unsupported data type.')
        buffer = numberToBuffer(request.dataType, request.value)
      }
    } catch (error) {
      throw new ControlError(CONTROL_ERROR_CODE.VALIDATION_ERROR, 'Request validation failed.', [
        { path: 'value', message: error instanceof Error ? error.message : String(error) }
      ])
    }
    const words: number[] = []
    for (let offset = 0; offset < buffer.length; offset += 2) {
      words.push(((buffer[offset] ?? 0) << 8) | (buffer[offset + 1] ?? 0))
    }
    assertBoundary(table, request.address, words.length)
    ModbusEngine.getInstance().writeRange(table, request.address, words)
    return { table, start: request.address, count: words.length, values: words }
  },

  logs(options: Parameters<ModbusEngine['queryLogs']>[0]) {
    return ModbusEngine.getInstance().queryLogs(options)
  },

  clearLogs() {
    ModbusEngine.getInstance().clearLogs()
    return { cleared: true }
  },

  config() {
    return {
      desired: getRuntimeCoordinator().getConfig(),
      actual: getRuntimeCoordinator().getLifecycle()
    }
  },

  async applyConfig(patch: ServerConfigPatch) {
    const effects = await getRuntimeCoordinator().applyConfig(patch)
    return {
      desired: getRuntimeCoordinator().getConfig(),
      actual: getRuntimeCoordinator().getLifecycle(),
      effects
    }
  },

  async serialPorts() {
    const ports = await SerialPort.list()
    return ports.map((port) => ({
      path: port.path,
      manufacturer: port.manufacturer || null,
      serialNumber: port.serialNumber || null
    }))
  },

  tcpClients() {
    return { clients: getTCPClients() }
  },

  disconnectAllClients() {
    return { disconnected: disconnectAllTCPClients() }
  },

  disconnectClient(id: number) {
    if (!disconnectTCPClient(id))
      throw new ControlError(CONTROL_ERROR_CODE.NOT_FOUND, 'TCP client was not found.')
    return { disconnected: id }
  }
}
