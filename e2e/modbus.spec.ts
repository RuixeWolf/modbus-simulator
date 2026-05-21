import { expect, test } from '@playwright/test'
import { MockModbusClient } from '../src/lib/modbus/mock-client'

test.describe.configure({ mode: 'serial' })

test.describe('Modbus Simulator E2E', () => {
  test('UI to Protocol: modify holding register via UI and read via Modbus client', async ({
    page
  }) => {
    // Navigate to the app
    await page.goto('/')

    // Wait for the page to load and TCP server to be running
    await expect(page.getByTestId('tcp-status')).toContainText('11502', {
      timeout: 30000
    })

    // Switch to Holding Registers tab
    await page.getByRole('tab', { name: /Holding Registers/i }).click()

    // Find the holding register input for address 0 and enter a value
    const input = page.getByTestId('register-input-0')
    await input.fill('1234')

    // Click the Set button
    await page.getByTestId('register-submit-0').click()

    // Wait a moment for the API call to complete
    await page.waitForTimeout(500)

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

  test('Error handling: illegal address request logs error', async ({ page }) => {
    await page.goto('/')

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

    // Also trigger an error via REST API to ensure error logging works
    await page.evaluate(async () => {
      await fetch('/api/registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registerType: 'holdingRegister', address: 99999, value: 1 })
      })
    })

    // Wait for log to appear via polling
    await page.waitForTimeout(2000)

    // Open the communication logs modal
    await page.getByRole('button', { name: /Communication Logs/i }).click()
    await page.waitForTimeout(300)

    // Check that the log panel shows an error
    const logPanel = page.getByTestId('log-panel')
    await expect(logPanel).toContainText('ERROR', { timeout: 10000 })
  })

  test('TCP client management: connect, view, disconnect via UI', async ({ page }) => {
    await page.goto('/')

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
      await fetch('/api/logs', { method: 'DELETE' })
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
})
