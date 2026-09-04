import { createServer } from 'node:net'
import { expect, test } from '@playwright/test'
import { MockModbusClient } from '../src/lib/modbus/mock-client'

test.describe.configure({ mode: 'serial' })

const API_TOKEN = 'playwright-control-token'

async function authenticate(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('api-token-input')).toBeVisible()
  await page.getByTestId('api-token-input').fill(API_TOKEN)
  await page.getByTestId('api-token-submit').click()
  await expect(page.getByTestId('api-token-input')).not.toBeVisible()
}

const authHeaders = { Authorization: `Bearer ${API_TOKEN}` }

test.describe('Modbus Simulator E2E', () => {
  test('UI to Protocol: modify holding register via UI and read via Modbus client', async ({
    page
  }) => {
    // Navigate to the app
    await page.goto('/')
    await authenticate(page)

    // Wait for the page to load and TCP server to be running
    await expect(page.getByTestId('tcp-status')).toContainText('11502', {
      timeout: 30000
    })

    // Switch to Holding Registers tab
    await page.getByRole('tab', { name: /Holding Registers/i }).click()

    // Find the holding register input for address 0 and enter a value
    const input = page.getByTestId('register-input-0')
    await input.fill('1234')

    const writeResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/registers/holding-registers') &&
        response.request().method() === 'PUT'
    )
    await page.getByTestId('register-submit-0').click()
    expect((await writeResponse).ok()).toBe(true)
    await expect(page.getByTestId('row-holdingRegister-0')).toContainText('1234')

    // Connect a mock Modbus client and read the value
    const client = new MockModbusClient('tcp', 'localhost', 11502)
    await client.connect()

    try {
      const value = await client.readHoldingRegister(0)
      expect(value).toBe(1234)
    } finally {
      await client.disconnect()
    }
  })

  test('Protocol to UI: write via Modbus client and verify UI update', async ({ page }) => {
    await page.goto('/')
    await authenticate(page)

    // Wait for server
    await expect(page.getByTestId('tcp-status')).toContainText('11502', {
      timeout: 30000
    })

    // Write via Modbus client
    const client = new MockModbusClient('tcp', 'localhost', 11502)
    await client.connect()

    try {
      await client.writeHoldingRegister(5, 5678)
    } finally {
      await client.disconnect()
    }

    // Wait for the UI to poll and update
    await page.waitForTimeout(1500)

    // Switch to Holding Registers tab and verify the UI shows the updated value
    await page.getByRole('tab', { name: /Holding Registers/i }).click()
    const row = page.getByTestId('row-holdingRegister-5')
    await expect(row).toContainText('5678')
    await expect(row).toContainText('0x162e')
  })

  test('Coil read/write: UI toggle and client verification', async ({ page }) => {
    await page.goto('/')
    await authenticate(page)

    await expect(page.getByTestId('tcp-status')).toContainText('11502', {
      timeout: 30000
    })

    // Toggle coil 0 via UI
    const coilSwitch = page.getByTestId('coil-switch-0')
    await coilSwitch.click()

    // Verify button text changed to ON
    await expect(coilSwitch).toContainText('ON')

    await page.waitForTimeout(500)

    // Verify via client
    const client = new MockModbusClient('tcp', 'localhost', 11502)
    await client.connect()

    try {
      const value = await client.readCoil(0)
      expect(value).toBe(true)

      // Write coil 1 via client
      await client.writeCoil(1, true)
    } finally {
      await client.disconnect()
    }

    // Wait for UI update
    await page.waitForTimeout(1500)

    // Verify coil 1 is now TRUE in UI
    const row = page.getByTestId('row-coil-1')
    await expect(row).toContainText('TRUE')
  })

  test('Error handling: illegal address requests return validation errors', async ({ page }) => {
    await page.goto('/')
    await authenticate(page)

    await expect(page.getByTestId('tcp-status')).toContainText('11502', {
      timeout: 30000
    })

    // Request an illegal address via client to trigger server-side error
    const client = new MockModbusClient('tcp', 'localhost', 11502)
    await client.connect()

    try {
      await client.readHoldingRegister(99999)
    } catch {
      // Expected to fail - modbus-serial throws on exception response
    } finally {
      await client.disconnect()
    }

    const apiResult = await page.evaluate(async () => {
      const response = await fetch('/api/v1/registers/holding-registers', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer playwright-control-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ start: 99999, values: [1] })
      })
      return { status: response.status, body: await response.json() }
    })
    expect(apiResult.status).toBe(422)
    expect(apiResult.body.error.code).toBe('VALIDATION_ERROR')
  })

  test('TCP client management: connect, view, disconnect via UI', async ({ page }) => {
    await page.goto('/')
    await authenticate(page)

    await expect(page.getByTestId('tcp-status')).toContainText('11502', {
      timeout: 30000
    })

    // Initially no clients
    await expect(page.getByTestId('tcp-client-count')).toContainText('No clients')

    // Connect a mock Modbus client and perform a read to ensure the connection is active
    const client = new MockModbusClient('tcp', 'localhost', 11502)
    await client.connect()
    await client.readHoldingRegister(0)

    try {
      // Wait for polling to update client count
      await expect(page.getByTestId('tcp-client-count')).toContainText('1 clients', {
        timeout: 10000
      })

      // Open the client panel
      await page.getByTestId('tcp-client-count').click()
      await page.waitForTimeout(300)

      // Verify the panel shows the connected client
      const clientPanel = page.getByTestId('tcp-client-panel')
      await expect(clientPanel).toContainText('127.0.0.1')
      await expect(clientPanel).toContainText('Disconnect')

      // Disconnect the client
      await page
        .getByRole('button', { name: /Disconnect/i })
        .first()
        .click()

      // Wait for the client count to update
      await expect(page.getByTestId('tcp-client-count')).toContainText('No clients', {
        timeout: 5000
      })

      // Close the client panel modal
      await page.getByRole('button', { name: /Close/i }).first().click()
      await page.waitForTimeout(300)
    } finally {
      await client.disconnect()
    }

    // Open communication logs and verify disconnect log
    await page.evaluate(async () => {
      await fetch('/api/v1/logs', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer playwright-control-token' }
      })
    })

    // Reconnect and disconnect to generate a fresh log
    const client2 = new MockModbusClient('tcp', 'localhost', 11502)
    await client2.connect()
    await client2.disconnect()

    await page.waitForTimeout(1500)

    await page.getByRole('button', { name: /Communication Logs/i }).click()
    await page.waitForTimeout(300)

    const logPanel = page.getByTestId('log-panel')
    await expect(logPanel).toContainText('CONNECTION', { timeout: 10000 })
  })

  test('removed unversioned routes return 404', async ({ request }) => {
    const paths = [
      '/api/registers',
      '/api/registers/batch',
      '/api/logs',
      '/api/status',
      '/api/config',
      '/api/serial-ports',
      '/api/tcp-clients',
      '/api/tcp-clients/1'
    ]

    for (const path of paths) {
      expect((await request.get(path)).status(), path).toBe(404)
    }
  })

  test('Token prompt rejects invalid credentials and stores valid credentials per session only', async ({
    page
  }) => {
    await page.goto('/')
    await expect(page.getByTestId('api-token-input')).toBeVisible()
    await page.getByTestId('api-token-input').fill('wrong-token')
    await page.getByTestId('api-token-submit').click()
    await expect(
      page.getByRole('dialog').getByText('A valid Bearer token is required.')
    ).toBeVisible()

    expect(
      await page.evaluate(() => ({
        local: localStorage.getItem('modbus-simulator-control'),
        session: sessionStorage.getItem('modbus-simulator-control')
      }))
    ).toEqual({ local: null, session: null })

    await page.getByTestId('api-token-input').fill(API_TOKEN)
    await page.getByTestId('api-token-submit').click()
    await expect(page.getByTestId('tcp-status')).toContainText('11502')
    expect(
      await page.evaluate(() => ({
        local: localStorage.getItem('modbus-simulator-control'),
        session: sessionStorage.getItem('modbus-simulator-control')
      }))
    ).toEqual({ local: null, session: API_TOKEN })
  })

  test('Agent workflow keeps HTTP and Modbus state consistent and exposes cursor logs', async ({
    request
  }) => {
    const reset = await request.post('/api/v1/state/reset', {
      headers: authHeaders,
      data: { tables: ['holding-registers'], clearLogs: true }
    })
    expect(reset.ok()).toBe(true)

    const config = await request.patch('/api/v1/config', {
      headers: authHeaders,
      data: { logMaxCount: 250 }
    })
    expect(config.ok()).toBe(true)
    expect((await config.json()).data.effects).toEqual({
      tcpRestarted: false,
      rtuRestarted: false,
      tcpClientsDisconnected: 0
    })

    const httpWrite = await request.put('/api/v1/registers/holding-registers', {
      headers: authHeaders,
      data: { start: 10, values: [3210] }
    })
    expect(httpWrite.ok()).toBe(true)

    const client = new MockModbusClient('tcp', '127.0.0.1', 11502)
    await client.connect()
    try {
      expect(await client.readHoldingRegister(10)).toBe(3210)
      await client.writeHoldingRegister(11, 4321)
    } finally {
      await client.disconnect()
    }

    const httpRead = await request.get('/api/v1/registers/holding-registers?start=10&count=2', {
      headers: authHeaders
    })
    expect((await httpRead.json()).data.values).toEqual([3210, 4321])

    const firstLogs = await request.get('/api/v1/logs?afterId=0&limit=100', {
      headers: authHeaders
    })
    const firstLogData = (await firstLogs.json()).data
    expect(firstLogData.entries.length).toBeGreaterThan(0)
    expect(
      firstLogData.entries.some(
        (entry: { source?: { type: string } }) => entry.source?.type === 'api'
      )
    ).toBe(true)
    const next = await request.get(`/api/v1/logs?afterId=${firstLogData.nextAfterId}&limit=100`, {
      headers: authHeaders
    })
    expect((await next.json()).data.entries).toEqual([])

    const serialPorts = await request.get('/api/v1/serial-ports', { headers: authHeaders })
    expect(serialPorts.ok()).toBe(true)
    expect(Array.isArray((await serialPorts.json()).data)).toBe(true)

    const unknownClient = await request.delete('/api/v1/tcp-clients/999999', {
      headers: authHeaders
    })
    expect(unknownClient.status()).toBe(404)
  })

  test('v1 writes are strict and atomic', async ({ request }) => {
    await request.put('/api/v1/registers/holding-registers', {
      headers: authHeaders,
      data: { start: 20, values: [7, 8] }
    })

    const invalid = await request.put('/api/v1/registers/holding-registers', {
      headers: authHeaders,
      data: { start: 20, values: [9, 65536] }
    })
    expect(invalid.status()).toBe(422)
    expect((await invalid.json()).error.code).toBe('VALIDATION_ERROR')

    const unchanged = await request.get('/api/v1/registers/holding-registers?start=20&count=2', {
      headers: authHeaders
    })
    expect((await unchanged.json()).data.values).toEqual([7, 8])

    const tooLarge = await request.get('/api/v1/registers/holding-registers?start=0&count=1001', {
      headers: authHeaders
    })
    expect(tooLarge.status()).toBe(422)

    const unauthorized = await request.get('/api/v1/health')
    expect(unauthorized.status()).toBe(401)
    expect(JSON.stringify(await unauthorized.json())).not.toContain(API_TOKEN)
  })

  test('failed TCP reconfiguration retains desired state and can recover', async ({ request }) => {
    const occupied = createServer()
    await new Promise<void>((resolve, reject) => {
      occupied.once('error', reject)
      occupied.listen(0, '127.0.0.1', resolve)
    })
    const address = occupied.address()
    if (!address || typeof address === 'string') throw new Error('Expected an IPv4 listener')

    try {
      const failed = await request.patch('/api/v1/config', {
        headers: authHeaders,
        data: { tcpPort: address.port }
      })
      const failedBody = await failed.json()
      expect(failed.status(), JSON.stringify(failedBody)).toBe(503)

      const afterFailure = await request.get('/api/v1/config', { headers: authHeaders })
      const failedConfig = (await afterFailure.json()).data
      expect(failedConfig.desired.tcpPort).toBe(address.port)
      expect(failedConfig.actual.tcp.state).toBe('error')
    } finally {
      await new Promise<void>((resolve) => occupied.close(() => resolve()))
      const recovered = await request.patch('/api/v1/config', {
        headers: authHeaders,
        data: { tcpPort: 11502 }
      })
      expect(recovered.ok()).toBe(true)
    }
  })
})
