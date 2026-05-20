'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Input, Label, ListBox, Select, Switch } from '@heroui/react'
import type { Key } from '@heroui/react'
import { Icon } from '@iconify/react'

/** Metadata for an available serial port. */
interface SerialPortInfo {
  path: string
  manufacturer: string | null
  serialNumber: string | null
}

/** Serial port RTU Parity options. */
type RtuParity = 'none' | 'even' | 'odd'

/** Mutable server configuration. */
interface ServerConfig {
  tcpEnabled: boolean
  tcpPort: number
  slaveId: number
  rtuEnabled: boolean
  rtuSerialPath: string | null
  rtuBaudRate: number
  rtuParity: RtuParity
  rtuDataBits: number
  rtuStopBits: number
  logMaxCount: number
}

/** Props for {@link SettingsPanel}. */
interface SettingsPanelProps {
  /** Current server configuration. */
  config: ServerConfig
  /** Available serial ports discovered by the backend. */
  serialPorts: SerialPortInfo[]
  /** Called when the user presses "Apply". */
  onApply: (config: ServerConfig) => void | Promise<void>
}

/** Available baud rates for RTU serial communication. */
const BAUD_RATES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200]

/** Available parity options. */
const PARITY_OPTIONS: { value: RtuParity; labelKey: string }[] = [
  { value: 'none', labelKey: 'settings.parityNone' },
  { value: 'even', labelKey: 'settings.parityEven' },
  { value: 'odd', labelKey: 'settings.parityOdd' }
]

/** Available data bit options. */
const DATA_BITS = [5, 6, 7, 8]

/** Available stop bit options. */
const STOP_BITS = [1, 2]

/**
 * Card that lets the user change the TCP port and configure RTU serial parameters.
 *
 * @returns HeroUI Card with two columns (TCP and RTU) and an apply button.
 */
export function SettingsPanel({ config, serialPorts, onApply }: Readonly<SettingsPanelProps>) {
  const { t } = useTranslation()
  const [tcpEnabled, setTcpEnabled] = useState(config.tcpEnabled)
  const [tcpPort, setTcpPort] = useState(String(config.tcpPort))
  const [slaveId, setSlaveId] = useState(String(config.slaveId))
  const [rtuEnabled, setRtuEnabled] = useState(config.rtuEnabled)
  const [rtuPath, setRtuPath] = useState(config.rtuSerialPath || '')
  const [rtuBaudRate, setRtuBaudRate] = useState(String(config.rtuBaudRate))
  const [rtuParity, setRtuParity] = useState(config.rtuParity)
  const [rtuDataBits, setRtuDataBits] = useState(String(config.rtuDataBits))
  const [rtuStopBits, setRtuStopBits] = useState(String(config.rtuStopBits))
  const [logMaxCount, setLogMaxCount] = useState(String(config.logMaxCount))
  const [isApplying, setIsApplying] = useState(false)

  async function handleApply() {
    const port = Number.parseInt(tcpPort, 10)
    if (Number.isNaN(port) || port < 1 || port > 65535) return
    // Validate slave ID: must be a valid integer string (digits only, no decimals/scientific notation/whitespace)
    const trimmedSlaveId = slaveId.trim()
    if (!/^\d+$/.test(trimmedSlaveId)) return
    const sid = Number.parseInt(trimmedSlaveId, 10)
    if (sid < 1 || sid > 247) return
    const baudRate = Number.parseInt(rtuBaudRate, 10)
    if (Number.isNaN(baudRate)) return
    const dataBits = Number.parseInt(rtuDataBits, 10)
    if (Number.isNaN(dataBits)) return
    const stopBits = Number.parseInt(rtuStopBits, 10)
    if (Number.isNaN(stopBits)) return
    const maxCount = Number.parseInt(logMaxCount, 10)
    if (Number.isNaN(maxCount) || maxCount < 100 || maxCount > 10000) return

    setIsApplying(true)
    try {
      await onApply({
        tcpEnabled,
        tcpPort: port,
        slaveId: sid,
        rtuEnabled,
        rtuSerialPath: rtuPath || null,
        rtuBaudRate: baudRate,
        rtuParity,
        rtuDataBits: dataBits,
        rtuStopBits: stopBits,
        logMaxCount: maxCount
      })
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Card className="w-full bg-default/50 shadow-none">
      <Card.Header>
        <div className="flex items-center gap-3">
          <div className="bg-default text-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
            <Icon icon="lucide:settings" className="h-4 w-4" />
          </div>
          <h2 className="text-base font-semibold">{t('settings.title')}</h2>
        </div>
      </Card.Header>
      <Card.Content>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 px-2">
          {/* RTU Serial Port */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-foreground text-sm font-semibold">
                  {t('settings.rtuSerialPort')}
                </span>
              </div>
              <Switch isSelected={rtuEnabled} onChange={setRtuEnabled} size="sm">
                <span className="text-sm">{t('settings.rtuEnabled')}</span>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            <Select
              placeholder={t('settings.selectSerialPort')}
              value={rtuPath || null}
              onChange={(value: Key | null) => setRtuPath(String(value ?? ''))}
              data-testid="rtu-serial-select"
              className="w-full"
              isDisabled={!rtuEnabled}
            >
              <Label className="sr-only">{t('settings.rtuSerialPort')}</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {serialPorts.length === 0 && (
                    <ListBox.Item id="" textValue={t('settings.noSerialPorts')} isDisabled>
                      {t('settings.noSerialPorts')}
                    </ListBox.Item>
                  )}
                  {serialPorts.map((port) => (
                    <ListBox.Item
                      key={port.path}
                      id={port.path}
                      textValue={`${port.path} ${port.manufacturer ?? ''}`}
                    >
                      {port.path}
                      {port.manufacturer ? ` (${port.manufacturer})` : ''}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            {/* Serial Parameters */}
            <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
              {/* Baud Rate */}
              <Select
                value={rtuBaudRate}
                onChange={(value: Key | null) => setRtuBaudRate(String(value ?? ''))}
                data-testid="rtu-baud-rate"
                className="w-full"
                isDisabled={!rtuEnabled}
              >
                <Label>{t('settings.baudRate')}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {BAUD_RATES.map((br) => (
                      <ListBox.Item key={br} id={String(br)} textValue={String(br)}>
                        {br}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              {/* Parity */}
              <Select
                value={rtuParity}
                onChange={(value: Key | null) =>
                  setRtuParity((value ?? 'none') as 'none' | 'even' | 'odd')
                }
                data-testid="rtu-parity"
                className="w-full"
                isDisabled={!rtuEnabled}
              >
                <Label>{t('settings.parity')}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {PARITY_OPTIONS.map((p) => (
                      <ListBox.Item key={p.value} id={p.value} textValue={t(p.labelKey)}>
                        {t(p.labelKey)}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              {/* Data Bits */}
              <Select
                value={rtuDataBits}
                onChange={(value: Key | null) => setRtuDataBits(String(value ?? ''))}
                data-testid="rtu-data-bits"
                className="w-full"
                isDisabled={!rtuEnabled}
              >
                <Label>{t('settings.dataBits')}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {DATA_BITS.map((db) => (
                      <ListBox.Item key={db} id={String(db)} textValue={String(db)}>
                        {db}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              {/* Stop Bits */}
              <Select
                value={rtuStopBits}
                onChange={(value: Key | null) => setRtuStopBits(String(value ?? ''))}
                data-testid="rtu-stop-bits"
                className="w-full"
                isDisabled={!rtuEnabled}
              >
                <Label>{t('settings.stopBits')}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {STOP_BITS.map((sb) => (
                      <ListBox.Item key={sb} id={String(sb)} textValue={String(sb)}>
                        {sb}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            <p className="text-text-muted text-xs">{t('settings.serialPortHint')}</p>
          </div>

          {/* TCP Port + Slave ID */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-foreground text-sm font-semibold">
                  {t('settings.tcpPort')}
                </span>
              </div>
              <Switch isSelected={tcpEnabled} onChange={setTcpEnabled} size="sm">
                <span className="text-sm">{t('settings.tcpEnabled')}</span>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={tcpPort}
                onChange={(e) => setTcpPort(e.target.value)}
                min={1}
                max={65535}
                className="w-32"
                data-testid="tcp-port-input"
                disabled={!tcpEnabled}
              />
              <span className="text-text-muted text-xs">
                {t('settings.default', { port: 502 })}
              </span>
            </div>

            {/* Slave ID */}
            <div className="pt-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-foreground text-sm font-semibold">
                  {t('settings.slaveId')}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Input
                  type="number"
                  value={slaveId}
                  onChange={(e) => {
                    setSlaveId(e.target.value)
                  }}
                  min={1}
                  max={247}
                  className="w-32"
                  data-testid="slave-id-input"
                />
                <span className="text-text-muted text-xs">{t('settings.slaveIdHint')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Log Settings */}
        <div className="border-border mt-5 border-t pt-4 px-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-purple-500" />
            <span className="text-foreground text-sm font-semibold">
              {t('settings.logMaxCount')}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <Input
              type="number"
              value={logMaxCount}
              onChange={(e) => setLogMaxCount(e.target.value)}
              min={100}
              max={10000}
              className="w-32"
              data-testid="log-max-count-input"
            />
            <span className="text-text-muted text-xs">{t('settings.logMaxCountHint')}</span>
          </div>
        </div>

        <div className="border-border mt-5 flex justify-end border-t pt-4">
          <Button
            variant="primary"
            onPress={handleApply}
            isDisabled={isApplying}
            data-testid="apply-settings"
          >
            {isApplying ? (
              <span className="flex items-center gap-2">
                <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin" />
                {t('settings.applying')}
              </span>
            ) : (
              t('settings.apply')
            )}
          </Button>
        </div>
      </Card.Content>
    </Card>
  )
}
