import packageJson from '@/package.json'

export const API_VERSION = '1'
export const PACKAGE_VERSION = packageJson.version
export const MAX_RANGE_VALUES = 1000
export const DEFAULT_HTTP_HOST = '127.0.0.1'
export const DEFAULT_HTTP_PORT = 5000
export const DEFAULT_TCP_HOST = '127.0.0.1'
export const DEFAULT_TCP_PORT = 502

export const TRANSPORT_STATE = {
  DISABLED: 'disabled',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  ERROR: 'error'
} as const

export type TransportState = (typeof TRANSPORT_STATE)[keyof typeof TRANSPORT_STATE]
