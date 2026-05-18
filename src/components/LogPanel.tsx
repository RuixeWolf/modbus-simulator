'use client'

import { useTranslation } from 'react-i18next'
import type { LogFilterConfig, ModbusLogEntry } from '@/src/hooks/useModbusData'
import { Button, Modal, ScrollShadow, ToggleButton, ToggleButtonGroup } from '@heroui/react'

/** Props for {@link LogPanel}. */
interface LogPanelProps {
  /** Chronological log entries; rendered newest-first. */
  logs: ModbusLogEntry[]
  /** Current log filter configuration. */
  logFilter: LogFilterConfig
  /** Called when the user toggles a log type. */
  onFilterChange: (filter: Partial<LogFilterConfig>) => void
}

/**
 * Communication logs displayed in a Modal dialog.
 *
 * @returns A trigger button that opens a modal dialog containing the log list.
 */
export function LogPanel({ logs, logFilter, onFilterChange }: Readonly<LogPanelProps>) {
  const { t } = useTranslation()

  const selectedKeys = new Set(
    Object.entries(logFilter)
      .filter(([, enabled]) => enabled)
      .map(([type]) => type)
  )

  const handleSelectionChange = (keys: Set<string | number>) => {
    onFilterChange({
      read: keys.has('read'),
      write: keys.has('write'),
      error: keys.has('error')
    })
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'read':
        return (
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
            {t('logs.read')}
          </span>
        )
      case 'write':
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            {t('logs.write')}
          </span>
        )
      case 'error':
        return (
          <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
            {t('logs.error')}
          </span>
        )
      default:
        return (
          <span className="bg-muted text-text-muted inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold">
            {type.toUpperCase()}
          </span>
        )
    }
  }

  return (
    <Modal>
      <Button variant="secondary">
        {t('logs.title')}
        <span className="text-text-muted bg-muted ml-2 rounded-full px-2 py-0.5 font-mono text-xs">
          {logs.length}
        </span>
      </Button>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="sm:max-w-3xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t('logs.title')}</Modal.Heading>
              <p className="text-muted text-sm leading-5">
                {t('logs.entries', { count: logs.length })}
              </p>
            </Modal.Header>
            <Modal.Body className="px-0 py-0">
              <div className="border-border flex items-center gap-3 border-b px-5 py-3">
                <span className="text-text-muted text-xs font-medium">{t('logs.filter')}:</span>
                <ToggleButtonGroup
                  selectionMode="multiple"
                  selectedKeys={selectedKeys}
                  onSelectionChange={handleSelectionChange}
                  className="bg-muted/50 inline-flex rounded-lg p-0.5 gap-1"
                >
                  <ToggleButton
                    id="read"
                    className="text-text-muted data-[selected=true]:bg-surface data-[selected=true]:text-foreground rounded-md px-3 py-1 text-xs font-medium transition-all"
                  >
                    {t('logs.read')}
                  </ToggleButton>
                  <ToggleButtonGroup.Separator className="bg-border my-auto h-4 w-px" />
                  <ToggleButton
                    id="write"
                    className="text-text-muted data-[selected=true]:bg-surface data-[selected=true]:text-foreground rounded-md px-3 py-1 text-xs font-medium transition-all"
                  >
                    {t('logs.write')}
                  </ToggleButton>
                  <ToggleButtonGroup.Separator className="bg-border my-auto h-4 w-px" />
                  <ToggleButton
                    id="error"
                    className="text-text-muted data-[selected=true]:bg-surface data-[selected=true]:text-foreground rounded-md px-3 py-1 text-xs font-medium transition-all"
                  >
                    {t('logs.error')}
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>
              <ScrollShadow className="max-h-[60vh] w-full">
                <div className="font-mono text-sm" data-testid="log-panel">
                  {logs.length === 0 && (
                    <div className="text-text-muted flex h-32 items-center justify-center italic">
                      <span>{t('logs.noLogs')}</span>
                    </div>
                  )}
                  {[...logs].reverse().map((log, i) => (
                    <div
                      key={`${log.timestamp}-${i}`}
                      className={`flex items-center gap-3 px-5 py-1.5 ${
                        i % 2 === 0 ? 'bg-muted/20' : ''
                      }`}
                    >
                      <span className="text-text-muted w-16 shrink-0 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      {getTypeBadge(log.type)}
                      <span className="text-text-muted font-mono text-xs">
                        {log.registerType}@{log.address}
                      </span>
                      {log.value !== undefined && (
                        <span className="text-foreground font-mono text-xs font-semibold">
                          = {String(log.value)}
                        </span>
                      )}
                      {log.message && (
                        <span className="text-text-muted truncate text-xs">{log.message}</span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollShadow>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary" className="w-full">
                {t('common.close')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
