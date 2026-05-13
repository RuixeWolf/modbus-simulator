declare module 'modbus-serial' {
  import { EventEmitter } from 'events';

  /**
   * Handler map passed to ServerTCP. Each method receives a Modbus address,
   * unit ID, and a Node-style callback.
   */
  interface Vector {
    getCoil(
      addr: number,
      unitID: number,
      callback: (err: Error | null, value: boolean) => void,
    ): void;
    getDiscreteInput(
      addr: number,
      unitID: number,
      callback: (err: Error | null, value: boolean) => void,
    ): void;
    getInputRegister(
      addr: number,
      unitID: number,
      callback: (err: Error | null, value: number) => void,
    ): void;
    getHoldingRegister(
      addr: number,
      unitID: number,
      callback: (err: Error | null, value: number) => void,
    ): void;
    setCoil(
      addr: number,
      value: boolean,
      unitID: number,
      callback: (err: Error | null) => void,
    ): void;
    setRegister(
      addr: number,
      value: number,
      unitID: number,
      callback: (err: Error | null) => void,
    ): void;
  }

  /** Options passed to the ServerTCP constructor. */
  interface ServerOptions {
    host?: string;
    port?: number;
    debug?: boolean;
    unitID?: number;
  }

  /** TCP-based Modbus server backed by a user-provided Vector. */
  class ServerTCP extends EventEmitter {
    constructor(vector: Vector, options: ServerOptions);
    close(): void;
  }

  /** Response shape returned by coil/discrete-input read operations. */
  interface ReadCoilsResponse {
    data: boolean[];
    buffer: Buffer;
  }

  /** Response shape returned by register read operations. */
  interface ReadRegistersResponse {
    data: number[];
    buffer: Buffer;
  }

  /** Response shape returned by write operations. */
  interface WriteResponse {
    address: number;
    value: number;
  }

  /** Client for connecting to a Modbus server over TCP. */
  class ModbusRTU {
    constructor();
    connectTCP(ip: string, options: { port: number }): Promise<void>;
    connectTcpRTU(ip: string, options: { port: number }): Promise<void>;
    close(callback?: () => void): void;
    setID(id: number): void;
    readCoils(address: number, length: number): Promise<ReadCoilsResponse>;
    readDiscreteInputs(address: number, length: number): Promise<ReadCoilsResponse>;
    readHoldingRegisters(address: number, length: number): Promise<ReadRegistersResponse>;
    readInputRegisters(address: number, length: number): Promise<ReadRegistersResponse>;
    writeCoil(address: number, state: boolean): Promise<WriteResponse>;
    writeRegister(address: number, value: number): Promise<WriteResponse>;
    writeCoils(address: number, states: boolean[]): Promise<WriteResponse>;
    writeRegisters(address: number, values: number[]): Promise<WriteResponse>;
  }

  export { ServerTCP, ModbusRTU };
  export default ModbusRTU;
}
