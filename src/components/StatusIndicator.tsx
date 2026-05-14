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
  rtuPath
}: Readonly<StatusIndicatorProps>) {
  const { t } = useTranslation()

  return (
    <div className="bg-surface flex items-center gap-4 rounded-full px-4 py-2 shadow-sm">
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
          <span className="text-text-muted font-mono text-[10px]">
            {tcpPort} {tcp ? '●' : '○'}
          </span>
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
          <span className="text-text-muted max-w-[80px] truncate font-mono text-[10px]">
            {rtuPath || t('header.notSet')}
          </span>
        </div>
      </div>
    </div>
  )
}
