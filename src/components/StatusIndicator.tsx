'use client'

import { useTranslation } from 'react-i18next'

/** Props for {@link StatusIndicator}. */
interface StatusIndicatorProps {
  /** Whether the TCP server is currently running. */
  tcp: boolean
  /** Whether the RTU serial server is currently running. */
  rtu: boolean
  /** TCP port displayed next to the TCP label. */
  tcpPort?: number
  /** Active serial port path; shown as "Not set" when null. */
  rtuPath?: string | null
  /** Number of currently connected TCP clients. */
  tcpClientCount?: number
  /** Called when the user clicks the TCP client count badge. */
  onOpenClientPanel?: () => void
}

/**
 * Soft pill showing TCP and RTU server health with status dots.
 *
 * @returns Styled container with two status blocks.
 */
export function StatusIndicator({
  tcp,
  rtu,
  tcpPort = 502,
  rtuPath,
  tcpClientCount = 0,
  onOpenClientPanel
}: Readonly<StatusIndicatorProps>) {
  const { t } = useTranslation()

  return (
    <div className="bg-surface flex items-center gap-3 rounded-full px-3 py-1.5 shadow-sm sm:gap-4 sm:px-4 sm:py-2">
      <div className="flex items-center gap-2" data-testid="tcp-status">
        <span className="relative flex size-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${
              tcp ? 'animate-pulse bg-emerald-400' : 'bg-red-400'
            }`}
          />
          <span
            className={`relative inline-flex size-2 rounded-full ${
              tcp ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          />
        </span>
        <div className="flex flex-col">
          <span className="text-foreground text-[11px] font-semibold">{t('header.tcp')}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted font-mono text-[10px]">
              {tcpPort} {tcp ? '●' : '○'}
            </span>
            {tcp && (
              <button
                type="button"
                onClick={onOpenClientPanel}
                className={`cursor-pointer text-left text-[10px] underline-offset-2 hover:underline ${
                  tcpClientCount > 0 ? 'text-blue-500 dark:text-blue-400' : 'text-text-muted'
                }`}
                data-testid="tcp-client-count"
              >
                {tcpClientCount === 0
                  ? t('header.tcpClients_zero')
                  : t('header.tcpClients', { count: tcpClientCount })}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-border h-5 w-px" />

      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${
              rtu ? 'animate-pulse bg-emerald-400' : 'bg-red-400'
            }`}
          />
          <span
            className={`relative inline-flex size-2 rounded-full ${
              rtu ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          />
        </span>
        <div className="flex flex-col">
          <span className="text-foreground text-[11px] font-semibold">{t('header.rtu')}</span>
          <span className="text-text-muted max-w-[3.75rem] truncate font-mono text-[10px] sm:max-w-[5rem]">
            {rtuPath || t('header.notSet')}
          </span>
        </div>
      </div>
    </div>
  )
}
