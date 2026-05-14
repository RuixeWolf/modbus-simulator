'use client';

import { Button, Modal, ScrollShadow } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import type { ModbusLogEntry } from '@/src/hooks/useModbusData';

/** Props for {@link LogPanel}. */
interface LogPanelProps {
  /** Chronological log entries; rendered newest-first. */
  logs: ModbusLogEntry[];
}

/**
 * Communication logs displayed in a Modal dialog.
 *
 * @returns A trigger button that opens a modal dialog containing the log list.
 */
export function LogPanel({ logs }: Readonly<LogPanelProps>) {
  const { t } = useTranslation();

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'read':
        return (
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
            {t('logs.read')}
          </span>
        );
      case 'write':
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            {t('logs.write')}
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
            {t('logs.error')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-text-muted">
            {type.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <Modal>
      <Button variant="secondary">
        {t('logs.title')}
        <span className="ml-2 text-xs text-text-muted bg-muted px-2 py-0.5 rounded-full font-mono">
          {logs.length}
        </span>
      </Button>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="sm:max-w-3xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t('logs.title')}</Modal.Heading>
              <p className="text-sm leading-5 text-muted">
                {t('logs.entries', { count: logs.length })}
              </p>
            </Modal.Header>
            <Modal.Body className="px-0 py-0">
              <ScrollShadow className="max-h-[60vh] w-full">
                <div className="font-mono text-sm" data-testid="log-panel">
                  {logs.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-text-muted italic">
                      <span>{t('logs.noLogs')}</span>
                    </div>
                  )}
                  {[...logs].reverse().map((log, i) => (
                    <div
                      key={`${log.timestamp}-${i}`}
                      className={`flex items-center gap-3 py-1.5 px-5 ${
                        i % 2 === 0 ? 'bg-muted/20' : ''
                      }`}
                    >
                      <span className="text-text-muted shrink-0 text-[11px] w-16 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      {getTypeBadge(log.type)}
                      <span className="text-text-muted text-xs font-mono">
                        {log.registerType}@{log.address}
                      </span>
                      {log.value !== undefined && (
                        <span className="text-foreground text-xs font-semibold font-mono">
                          = {String(log.value)}
                        </span>
                      )}
                      {log.message && (
                        <span className="text-text-muted text-xs truncate">{log.message}</span>
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
  );
}
