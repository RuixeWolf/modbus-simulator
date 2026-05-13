'use client';

import { Card, Button, Input, Select, Label, ListBox } from '@heroui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Key } from '@heroui/react';

/** Metadata for an available serial port. */
interface SerialPortInfo {
  path: string;
  manufacturer: string | null;
  serialNumber: string | null;
}

/** Mutable server configuration. */
interface ServerConfig {
  tcpPort: number;
  rtuSerialPath: string | null;
  rtuBaudRate: number;
  rtuParity: 'none' | 'even' | 'odd';
  rtuDataBits: number;
  rtuStopBits: number;
}

/** Props for {@link SettingsPanel}. */
interface SettingsPanelProps {
  /** Current server configuration. */
  config: ServerConfig;
  /** Available serial ports discovered by the backend. */
  serialPorts: SerialPortInfo[];
  /** Called when the user presses "Apply". */
  onApply: (config: ServerConfig) => void;
}

/** Available baud rates for RTU serial communication. */
const BAUD_RATES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

/** Available parity options. */
const PARITY_OPTIONS: { value: 'none' | 'even' | 'odd'; labelKey: string }[] = [
  { value: 'none', labelKey: 'settings.parityNone' },
  { value: 'even', labelKey: 'settings.parityEven' },
  { value: 'odd', labelKey: 'settings.parityOdd' },
];

/** Available data bit options. */
const DATA_BITS = [5, 6, 7, 8];

/** Available stop bit options. */
const STOP_BITS = [1, 2];

/**
 * Card that lets the user change the TCP port and configure RTU serial parameters.
 *
 * @returns HeroUI Card with two columns (TCP and RTU) and an apply button.
 */
export function SettingsPanel({ config, serialPorts, onApply }: Readonly<SettingsPanelProps>) {
  const { t } = useTranslation();
  const [tcpPort, setTcpPort] = useState(String(config.tcpPort));
  const [rtuPath, setRtuPath] = useState(config.rtuSerialPath || '');
  const [rtuBaudRate, setRtuBaudRate] = useState(String(config.rtuBaudRate));
  const [rtuParity, setRtuParity] = useState(config.rtuParity);
  const [rtuDataBits, setRtuDataBits] = useState(String(config.rtuDataBits));
  const [rtuStopBits, setRtuStopBits] = useState(String(config.rtuStopBits));

  const handleApply = () => {
    const port = Number.parseInt(tcpPort, 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) return;
    const baudRate = Number.parseInt(rtuBaudRate, 10);
    if (Number.isNaN(baudRate)) return;
    const dataBits = Number.parseInt(rtuDataBits, 10);
    if (Number.isNaN(dataBits)) return;
    const stopBits = Number.parseInt(rtuStopBits, 10);
    if (Number.isNaN(stopBits)) return;
    onApply({
      tcpPort: port,
      rtuSerialPath: rtuPath || null,
      rtuBaudRate: baudRate,
      rtuParity,
      rtuDataBits: dataBits,
      rtuStopBits: stopBits,
    });
  };

  return (
    <Card className="w-full rounded-2xl shadow-lg shadow-black/5 bg-surface border border-border/40">
      <Card.Header className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-foreground text-sm font-bold">
            ⚙
          </div>
          <h2 className="text-base font-semibold">{t('settings.title')}</h2>
        </div>
      </Card.Header>
      <Card.Content className="px-5 py-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* TCP Port */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <label className="text-sm font-semibold text-foreground">
                {t('settings.tcpPort')}
              </label>
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
              />
              <span className="text-xs text-text-muted">
                {t('settings.default', { port: 502 })}
              </span>
            </div>
          </div>

          {/* RTU Serial Port */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <label className="text-sm font-semibold text-foreground">
                {t('settings.rtuSerialPort')}
              </label>
            </div>

            <Select
              placeholder={t('settings.selectSerialPort')}
              value={rtuPath || null}
              onChange={(value: Key | null) => setRtuPath(String(value ?? ''))}
              data-testid="rtu-serial-select"
              className="w-full"
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
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Baud Rate */}
              <Select
                value={rtuBaudRate}
                onChange={(value: Key | null) => setRtuBaudRate(String(value ?? ''))}
                data-testid="rtu-baud-rate"
                className="w-full"
              >
                <Label className="text-xs font-medium text-text-muted">
                  {t('settings.baudRate')}
                </Label>
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
              >
                <Label className="text-xs font-medium text-text-muted">
                  {t('settings.parity')}
                </Label>
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
              >
                <Label className="text-xs font-medium text-text-muted">
                  {t('settings.dataBits')}
                </Label>
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
              >
                <Label className="text-xs font-medium text-text-muted">
                  {t('settings.stopBits')}
                </Label>
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

            <p className="text-xs text-text-muted">{t('settings.serialPortHint')}</p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-border flex justify-end">
          <Button
            variant="primary"
            onPress={handleApply}
            data-testid="apply-settings"
            className="px-6 rounded-full"
          >
            {t('settings.apply')}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
