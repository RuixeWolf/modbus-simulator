export function isLoopbackHost(host) {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, '')
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
}

export async function waitForHealth({ baseUrl, token, timeoutSeconds, child }) {
  const deadline = Date.now() + timeoutSeconds * 1000
  let lastDiagnostic = 'HTTP control plane is not reachable.'
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`Simulator process exited with code ${child.exitCode}.`)
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined
      const response = await fetch(`${baseUrl}/api/v1/health`, {
        headers,
        signal: AbortSignal.timeout(1000)
      })
      const payload = await response.json()
      if (!response.ok) {
        lastDiagnostic = payload?.error?.message ?? `Health returned HTTP ${response.status}.`
      } else if (payload?.data?.ready) {
        return payload.data
      } else {
        const failed = Object.entries(payload?.data?.transports ?? {})
          .filter(([, value]) => value?.state === 'error')
          .map(([name, value]) => `${name}: ${value.error ?? 'unknown error'}`)
        lastDiagnostic = failed.length ? failed.join('; ') : 'Enabled transports are not ready.'
      }
    } catch (error) {
      lastDiagnostic = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(lastDiagnostic)
}

export function readyRecord(health, baseUrl) {
  return {
    packageVersion: health.packageVersion,
    apiVersion: health.apiVersion,
    instanceId: health.instanceId,
    httpBaseUrl: baseUrl,
    modbusTcp: health.transports.tcp.actualConfig
      ? `${health.transports.tcp.actualConfig.host}:${health.transports.tcp.actualConfig.port}`
      : null,
    transports: health.transports
  }
}

export function printReady(format, record) {
  if (format === 'json') console.log(`MODBUS_SIMULATOR_READY ${JSON.stringify(record)}`)
  else console.log(`Modbus Simulator ready: ${record.httpBaseUrl}`)
}

export function printReadyError(format, error) {
  const record = {
    code: 'READINESS_FAILED',
    message: error instanceof Error ? error.message : String(error)
  }
  if (format === 'json') console.error(`MODBUS_SIMULATOR_ERROR ${JSON.stringify(record)}`)
  else console.error(`Modbus Simulator is degraded: ${record.message}`)
}
