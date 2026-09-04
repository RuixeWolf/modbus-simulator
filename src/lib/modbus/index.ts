import { getRuntimeCoordinator } from './lifecycle'

export type { ServerConfig } from './control/schemas'
export {
  disconnectAllTCPClients,
  disconnectTCPClient,
  getTCPClients,
  getTCPHost,
  getTCPPort,
  isTCPServerRunning
} from './tcp-server'
export { getRTUSerialPath, isRTUSerialServerRunning } from './rtu-serial-server'

/** Starts configured transports once per process through the shared coordinator. */
export function ensureServersStarted(): Promise<void> {
  if (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PRIVATE_BUILD_WORKER === '1' ||
    process.env.IS_NEXT_WORKER === 'true' ||
    process.env.JEST_WORKER_ID !== undefined
  ) {
    return Promise.resolve()
  }
  return getRuntimeCoordinator().ensureStarted()
}

/** Starts the configured transports. Kept as a named compatibility entry point. */
export function startServers(): Promise<void> {
  return ensureServersStarted()
}

/** Restarts both transports through the serialized transition queue. */
export function restartServers(): Promise<void> {
  return getRuntimeCoordinator().restartAll()
}

/** Returns the desired runtime configuration. */
export function getConfig() {
  return getRuntimeCoordinator().getConfig()
}

/** Applies a validated partial configuration through the coordinator. */
export function setConfig(
  config: Parameters<ReturnType<typeof getRuntimeCoordinator>['applyConfig']>[0]
) {
  return getRuntimeCoordinator().applyConfig(config)
}
