import ModbusRTU from 'modbus-serial'

/** Transport mode used by MockModbusClient. */
export type ConnectionMode = 'tcp' | 'rtu'

/**
 * Test helper that connects to the simulator via Modbus TCP
 * (or TCP-bridge RTU) using the `modbus-serial` client.
 */
export class MockModbusClient {
  private client: InstanceType<typeof ModbusRTU>
  private mode: ConnectionMode
  private host: string
  private port: number
  private connected = false

  /**
   * @param mode – Transport mode ('tcp' or 'rtu'); currently both use TCP under the hood.
   * @param host – Target host (default "localhost").
   * @param port – Target port (default 502 for TCP, 5021 for RTU bridge).
   */
  constructor(mode: ConnectionMode = 'tcp', host = 'localhost', port?: number) {
    this.mode = mode
    this.host = host
    this.port = port ?? (mode === 'tcp' ? 502 : 5021)
    this.client = new ModbusRTU()
  }

  /** Opens the underlying TCP connection and sets slave ID to 1. */
  async connect(): Promise<void> {
    if (this.connected) return

    if (this.mode === 'tcp') {
      await this.client.connectTCP(this.host, { port: this.port })
    } else {
      await this.client.connectTCP(this.host, { port: this.port })
    }
    this.client.setID(1)
    this.connected = true
  }

  /** Closes the connection. */
  async disconnect(): Promise<void> {
    if (!this.connected) return
    this.client.close(() => {
      // closed
    })
    this.connected = false
  }

  /**
   * @param address – Zero-based coil address.
   * @returns Single coil value.
   */
  async readCoil(address: number): Promise<boolean> {
    this.ensureConnected()
    const res = await this.client.readCoils(address, 1)
    return res.data[0]
  }

  /**
   * @param start – Zero-based starting address.
   * @param count – Number of coils to read.
   * @returns Array of coil values.
   */
  async readCoils(start: number, count: number): Promise<boolean[]> {
    this.ensureConnected()
    const res = await this.client.readCoils(start, count)
    return res.data
  }

  /**
   * @param address – Zero-based coil address.
   * @param value   – New boolean value.
   */
  async writeCoil(address: number, value: boolean): Promise<void> {
    this.ensureConnected()
    await this.client.writeCoil(address, value)
  }

  /**
   * @param address – Zero-based holding register address.
   * @returns 16-bit unsigned value.
   */
  async readHoldingRegister(address: number): Promise<number> {
    this.ensureConnected()
    const res = await this.client.readHoldingRegisters(address, 1)
    return res.data[0]
  }

  /**
   * @param start – Zero-based starting address.
   * @param count – Number of registers to read.
   * @returns Array of 16-bit unsigned values.
   */
  async readHoldingRegisters(start: number, count: number): Promise<number[]> {
    this.ensureConnected()
    const res = await this.client.readHoldingRegisters(start, count)
    return res.data
  }

  /**
   * @param address – Zero-based holding register address.
   * @param value   – 16-bit value to write.
   */
  async writeHoldingRegister(address: number, value: number): Promise<void> {
    this.ensureConnected()
    await this.client.writeRegister(address, value)
  }

  /**
   * @param address – Zero-based input register address.
   * @returns 16-bit unsigned value.
   */
  async readInputRegister(address: number): Promise<number> {
    this.ensureConnected()
    const res = await this.client.readInputRegisters(address, 1)
    return res.data[0]
  }

  /**
   * @param address – Zero-based discrete input address.
   * @returns Single discrete input value.
   */
  async readDiscreteInput(address: number): Promise<boolean> {
    this.ensureConnected()
    const res = await this.client.readDiscreteInputs(address, 1)
    return res.data[0]
  }

  /** @throws When the client is not connected. */
  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Client not connected. Call connect() first.')
    }
  }
}
