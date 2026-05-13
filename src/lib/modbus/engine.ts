import { EventEmitter } from 'events';

/** Single communication log entry emitted by the Modbus engine. */
export interface ModbusLogEntry {
  /** ISO 8601 timestamp of when the operation occurred. */
  timestamp: string;
  /** Direction or outcome of the operation. */
  type: 'read' | 'write' | 'error';
  /** Register category involved in the operation (e.g. "coil", "holdingRegister"). */
  registerType: string;
  /** Zero-based Modbus address. */
  address: number;
  /** Value read or written; omitted for bulk reads or errors. */
  value?: number | boolean;
  /** Human-readable detail, often used for error descriptions. */
  message?: string;
}

/** Snapshot of all Modbus register arrays. */
export interface ModbusState {
  coils: boolean[];
  discreteInputs: boolean[];
  holdingRegisters: number[];
  inputRegisters: number[];
}

/** Number of coils allocated in the engine. */
const COIL_COUNT = 1000;
/** Number of discrete inputs allocated in the engine. */
const DISCRETE_INPUT_COUNT = 1000;
/** Number of holding registers allocated in the engine. */
const HOLDING_REGISTER_COUNT = 10000;
/** Number of input registers allocated in the engine. */
const INPUT_REGISTER_COUNT = 10000;
/** Maximum in-memory log entries before old entries are dropped. */
const MAX_LOGS = 1000;

/**
 * Singleton EventEmitter that owns all Modbus register state.
 *
 * Emits:
 * - `'change'` – when a coil or holding register is written.
 * - `'log'`    – on every logged read, write, or error.
 */
const gEngine = globalThis as typeof globalThis & { __modbus_engine_instance__?: ModbusEngine | null };

export class ModbusEngine extends EventEmitter {
  private static instance: ModbusEngine | null = gEngine.__modbus_engine_instance__ ?? null;

  private coils: boolean[];
  private discreteInputs: boolean[];
  private holdingRegisters: number[];
  private inputRegisters: number[];
  private logs: ModbusLogEntry[];

  private constructor() {
    super();
    this.coils = new Array(COIL_COUNT).fill(false);
    this.discreteInputs = new Array(DISCRETE_INPUT_COUNT).fill(false);
    this.holdingRegisters = new Array(HOLDING_REGISTER_COUNT).fill(0);
    this.inputRegisters = new Array(INPUT_REGISTER_COUNT).fill(0);
    this.logs = [];
  }

  /**
   * @returns The shared ModbusEngine instance.
   */
  static getInstance(): ModbusEngine {
    if (!ModbusEngine.instance) {
      ModbusEngine.instance = new ModbusEngine();
      gEngine.__modbus_engine_instance__ = ModbusEngine.instance;
    }
    return ModbusEngine.instance;
  }

  /**
   * Clears the singleton reference. Intended for unit tests only.
   */
  static resetInstance(): void {
    ModbusEngine.instance = null;
    gEngine.__modbus_engine_instance__ = null;
  }

  // Coils

  /**
   * @param address – Zero-based coil address.
   * @returns Current boolean value at the requested address.
   * @throws When address is out of range.
   */
  readCoil(address: number): boolean {
    if (address < 0 || address >= COIL_COUNT) {
      throw new Error(`Coil address ${address} out of range`);
    }
    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'read',
      registerType: 'coil',
      address,
      value: this.coils[address],
    });
    return this.coils[address];
  }

  /**
   * @param start  – Zero-based starting address.
   * @param count  – Number of consecutive coils to read.
   * @returns Array of boolean values.
   * @throws When the requested range exceeds allocated bounds.
   */
  readCoils(start: number, count: number): boolean[] {
    if (start < 0 || start + count > COIL_COUNT) {
      throw new Error(`Coil range [${start}, ${start + count}) out of range`);
    }
    const result = this.coils.slice(start, start + count);
    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'read',
      registerType: 'coil',
      address: start,
      message: `Read ${count} coils from ${start}`,
    });
    return result;
  }

  /**
   * @param address – Zero-based coil address.
   * @param value   – New boolean value to store.
   * @throws When address is out of range.
   */
  writeCoil(address: number, value: boolean): void {
    if (address < 0 || address >= COIL_COUNT) {
      throw new Error(`Coil address ${address} out of range`);
    }
    this.coils[address] = value;
    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'write',
      registerType: 'coil',
      address,
      value,
    });
    this.emit('change', { registerType: 'coil', address, value });
  }

  // Discrete Inputs

  /**
   * @param address – Zero-based discrete input address.
   * @returns Current boolean value at the requested address.
   * @throws When address is out of range.
   */
  readDiscreteInput(address: number): boolean {
    if (address < 0 || address >= DISCRETE_INPUT_COUNT) {
      throw new Error(`Discrete input address ${address} out of range`);
    }
    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'read',
      registerType: 'discreteInput',
      address,
      value: this.discreteInputs[address],
    });
    return this.discreteInputs[address];
  }

  /**
   * @param start  – Zero-based starting address.
   * @param count  – Number of consecutive discrete inputs to read.
   * @returns Array of boolean values.
   * @throws When the requested range exceeds allocated bounds.
   */
  readDiscreteInputs(start: number, count: number): boolean[] {
    if (start < 0 || start + count > DISCRETE_INPUT_COUNT) {
      throw new Error(`Discrete input range [${start}, ${start + count}) out of range`);
    }
    const result = this.discreteInputs.slice(start, start + count);
    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'read',
      registerType: 'discreteInput',
      address: start,
      message: `Read ${count} discrete inputs from ${start}`,
    });
    return result;
  }

  /**
   * @param address – Zero-based discrete input address.
   * @param value   – New boolean value to store.
   * @throws When address is out of range.
   */
  writeDiscreteInput(address: number, value: boolean): void {
    if (address < 0 || address >= DISCRETE_INPUT_COUNT) {
      throw new Error(`Discrete input address ${address} out of range`);
    }
    this.discreteInputs[address] = value;
    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'write',
      registerType: 'discreteInput',
      address,
      value,
    });
    this.emit('change', { registerType: 'discreteInput', address, value });
  }

  // Holding Registers

  /**
   * @param address – Zero-based holding register address.
   * @returns 16-bit unsigned value at the requested address.
   * @throws When address is out of range.
   */
  readHoldingRegister(address: number): number {
    if (address < 0 || address >= HOLDING_REGISTER_COUNT) {
      throw new Error(`Holding register address ${address} out of range`);
    }
    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'read',
      registerType: 'holdingRegister',
      address,
      value: this.holdingRegisters[address],
    });
    return this.holdingRegisters[address];
  }

  /**
   * @param start  – Zero-based starting address.
   * @param count  – Number of consecutive holding registers to read.
   * @returns Array of 16-bit unsigned values.
   * @throws When the requested range exceeds allocated bounds.
   */
  readHoldingRegisters(start: number, count: number): number[] {
    if (start < 0 || start + count > HOLDING_REGISTER_COUNT) {
      throw new Error(`Holding register range [${start}, ${start + count}) out of range`);
    }
    const result = this.holdingRegisters.slice(start, start + count);
    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'read',
      registerType: 'holdingRegister',
      address: start,
      message: `Read ${count} holding registers from ${start}`,
    });
    return result;
  }

  /**
   * @param address – Zero-based holding register address.
   * @param value   – Value to store; automatically masked to 16 bits (`0xffff`).
   * @throws When address is out of range.
   */
  writeHoldingRegister(address: number, value: number): void {
    if (address < 0 || address >= HOLDING_REGISTER_COUNT) {
      throw new Error(`Holding register address ${address} out of range`);
    }
    this.holdingRegisters[address] = value & 0xffff;
    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'write',
      registerType: 'holdingRegister',
      address,
      value: this.holdingRegisters[address],
    });
    this.emit('change', {
      registerType: 'holdingRegister',
      address,
      value: this.holdingRegisters[address],
    });
  }

  // Input Registers

  /**
   * @param address – Zero-based input register address.
   * @returns 16-bit unsigned value at the requested address.
   * @throws When address is out of range.
   */
  readInputRegister(address: number): number {
    if (address < 0 || address >= INPUT_REGISTER_COUNT) {
      throw new Error(`Input register address ${address} out of range`);
    }
    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'read',
      registerType: 'inputRegister',
      address,
      value: this.inputRegisters[address],
    });
    return this.inputRegisters[address];
  }

  /**
   * @param start  – Zero-based starting address.
   * @param count  – Number of consecutive input registers to read.
   * @returns Array of 16-bit unsigned values.
   * @throws When the requested range exceeds allocated bounds.
   */
  readInputRegisters(start: number, count: number): number[] {
    if (start < 0 || start + count > INPUT_REGISTER_COUNT) {
      throw new Error(`Input register range [${start}, ${start + count}) out of range`);
    }
    const result = this.inputRegisters.slice(start, start + count);
    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'read',
      registerType: 'inputRegister',
      address: start,
      message: `Read ${count} input registers from ${start}`,
    });
    return result;
  }

  /**
   * @param address – Zero-based input register address.
   * @param value   – Value to store; automatically masked to 16 bits (`0xffff`).
   * @throws When address is out of range.
   */
  writeInputRegister(address: number, value: number): void {
    if (address < 0 || address >= INPUT_REGISTER_COUNT) {
      throw new Error(`Input register address ${address} out of range`);
    }
    this.inputRegisters[address] = value & 0xffff;
    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'write',
      registerType: 'inputRegister',
      address,
      value: this.inputRegisters[address],
    });
    this.emit('change', {
      registerType: 'inputRegister',
      address,
      value: this.inputRegisters[address],
    });
  }

  // State

  /**
   * @returns Deep copy of the full register state.
   */
  getState(): ModbusState {
    return {
      coils: [...this.coils],
      discreteInputs: [...this.discreteInputs],
      holdingRegisters: [...this.holdingRegisters],
      inputRegisters: [...this.inputRegisters],
    };
  }

  // Logs

  /** Appends an entry and emits `'log'`. Drops oldest entry when capacity is exceeded. */
  private addLog(entry: ModbusLogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > MAX_LOGS) {
      this.logs.shift();
    }
    this.emit('log', entry);
  }

  /**
   * @returns Chronological array of all stored log entries.
   */
  getLogs(): ModbusLogEntry[] {
    return [...this.logs];
  }

  /**
   * Convenience helper for logging out-of-range or protocol errors.
   * @param registerType – Category that triggered the error.
   * @param address      – Modbus address involved.
   * @param message      – Human-readable error description.
   */
  addErrorLog(registerType: string, address: number, message: string): void {
    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'error',
      registerType,
      address,
      message,
    });
  }
}
