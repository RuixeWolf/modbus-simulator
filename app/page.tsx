'use client'

import '@/src/i18n'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/src/components/LanguageSwitcher'
import { LogPanel } from '@/src/components/LogPanel'
import { RegisterTable } from '@/src/components/RegisterTable'
import { SettingsPanel } from '@/src/components/SettingsPanel'
import { StatusIndicator } from '@/src/components/StatusIndicator'
import { ThemeToggle } from '@/src/components/ThemeToggle'
import { useModbusData } from '@/src/hooks/useModbusData'
import { Tabs } from '@heroui/react'

const SUPPORTED_LANGUAGES = ['en', 'zh', 'fr', 'ja'] as const

function detectLanguage(): string {
  if (!('window' in globalThis)) return 'en'
  const stored = localStorage.getItem('i18nextLng')
  if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) return stored
  const nav = navigator.language
  if (nav.startsWith('zh')) return 'zh'
  if (nav.startsWith('fr')) return 'fr'
  if (nav.startsWith('ja')) return 'ja'
  return 'en'
}

export default function Home() {
  const { t, i18n } = useTranslation()
  const {
    state,
    logs,
    status,
    config,
    serialPorts,
    logFilter,
    error,
    writeRegister,
    updateConfig,
    updateLogFilter,
    clearLogs
  } = useModbusData()

  useEffect(() => {
    const lng = detectLanguage()
    if (i18n.language !== lng) {
      void i18n.changeLanguage(lng)
    }
  }, [i18n])

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-1 flex-col gap-6 p-5 sm:p-8 lg:px-12 xl:max-w-360">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('app.title')}</h1>
          <p className="text-text-muted mt-1 text-sm">{t('app.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-3 sm:justify-end">
          <StatusIndicator
            tcp={status.tcp}
            rtu={status.rtu}
            tcpPort={config.tcpPort}
            rtuPath={config.rtuSerialPath}
          />
          <LogPanel
            logs={logs}
            logFilter={logFilter}
            onFilterChange={updateLogFilter}
            onClearLogs={clearLogs}
          />
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <span className="size-2 shrink-0 rounded-full bg-red-500" />
          {error}
        </div>
      )}

      <SettingsPanel
        key={`${config.tcpPort}-${config.slaveId}-${config.rtuSerialPath || ''}-${config.rtuBaudRate}-${config.rtuParity}-${config.rtuDataBits}-${config.rtuStopBits}`}
        config={config}
        serialPorts={serialPorts}
        onApply={updateConfig}
      />

      {/* Register Tables */}
      <Tabs defaultSelectedKey="coils" className="w-full">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Register tables" className="flex w-full overflow-x-auto">
            <Tabs.Tab id="coils">
              {t('tabs.coils')}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="discrete">
              {t('tabs.discreteInputs')}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="holding">
              {t('tabs.holdingRegisters')}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="input">
              {t('tabs.inputRegisters')}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="coils" className="animate-fade-in px-0">
          <RegisterTable
            title={t('tabs.coils')}
            type="coil"
            data={state.coils}
            writable
            onWrite={(addr, val) => writeRegister('coil', addr, val)}
          />
        </Tabs.Panel>
        <Tabs.Panel id="discrete" className="animate-fade-in px-0">
          <RegisterTable
            title={t('tabs.discreteInputs')}
            type="discreteInput"
            data={state.discreteInputs}
            writable
            onWrite={(addr, val) => writeRegister('discreteInput', addr, val)}
          />
        </Tabs.Panel>
        <Tabs.Panel id="holding" className="animate-fade-in px-0">
          <RegisterTable
            title={t('tabs.holdingRegisters')}
            type="holdingRegister"
            data={state.holdingRegisters}
            writable
            onWrite={(addr, val) => writeRegister('holdingRegister', addr, val)}
          />
        </Tabs.Panel>
        <Tabs.Panel id="input" className="animate-fade-in px-0">
          <RegisterTable
            title={t('tabs.inputRegisters')}
            type="inputRegister"
            data={state.inputRegisters}
            writable
            onWrite={(addr, val) => writeRegister('inputRegister', addr, val)}
          />
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
