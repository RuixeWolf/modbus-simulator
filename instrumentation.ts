import { ensureServersStarted } from '@/src/lib/modbus';

/**
 * Next.js instrumentation hook.
 * Called once when the Next.js server process starts.
 * Ensures Modbus TCP and RTU servers are started immediately
 * instead of waiting for the first HTTP API request (lazy loading).
 */
export async function register(): Promise<void> {
  ensureServersStarted();
}
