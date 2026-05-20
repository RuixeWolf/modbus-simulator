import { AsyncLocalStorage } from 'async_hooks'

/** Where a communication log entry originated from. */
export interface LogSource {
  /** Origin channel of the Modbus operation. */
  type: 'tcp' | 'serial' | 'web'
  /** Human-readable detail: IP:port for TCP, serial path for Serial, 'Web Console' for Web. */
  detail: string
}

const g = globalThis as typeof globalThis & {
  __modbus_log_source_store__?: AsyncLocalStorage<LogSource>
}

/**
 * AsyncLocalStorage used to propagate log source context from TCP/Serial/Web
 * entry points through to the ModbusEngine's addLog method without changing
 * every read/write method signature.
 *
 * Stored on globalThis so the same instance survives Next.js HMR / module reloads
 * and is shared across all bundles.
 */
export const logSourceStore = g.__modbus_log_source_store__ ?? new AsyncLocalStorage<LogSource>()
g.__modbus_log_source_store__ = logSourceStore
