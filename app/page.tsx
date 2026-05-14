'use client';

import '@/src/i18n';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useModbusData } from '@/src/hooks/useModbusData';
import { StatusIndicator } from '@/src/components/StatusIndicator';
import { RegisterTable } from '@/src/components/RegisterTable';
import { LogPanel } from '@/src/components/LogPanel';
import { SettingsPanel } from '@/src/components/SettingsPanel';
import { LanguageSwitcher } from '@/src/components/LanguageSwitcher';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import { Tabs } from '@heroui/react';

function detectLanguage(): string {
  if (globalThis.window === undefined) return 'en';
  const stored = localStorage.getItem('i18nextLng');
  if (stored === 'zh' || stored === 'en') return stored;
  const nav = navigator.language;
  return nav.startsWith('zh') ? 'zh' : 'en';
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const { state, logs, status, config, serialPorts, error, writeRegister, updateConfig } =
    useModbusData();

  useEffect(() => {
    const lng = detectLanguage();
    if (i18n.language !== lng) {
      void i18n.changeLanguage(lng);
    }
  }, [i18n]);

  return (
    <div className="flex flex-col flex-1 min-h-screen w-full p-5 sm:p-8 gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('app.title')}</h1>
          <p className="text-text-muted text-sm mt-1">{t('app.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <StatusIndicator
            tcp={status.tcp}
            rtu={status.rtu}
            tcpPort={config.tcpPort}
            rtuPath={config.rtuSerialPath}
          />
          <LogPanel logs={logs} />
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-3 rounded-2xl text-sm flex items-center gap-2">
          <span className="size-2 rounded-full bg-red-500 shrink-0" />
          {error}
        </div>
      )}

      <SettingsPanel
        key={`${config.tcpPort}-${config.rtuSerialPath}-${config.rtuBaudRate}-${config.slaveId}`}
        config={config}
        serialPorts={serialPorts}
        onApply={updateConfig}
      />

      {/* Register Tables */}
      <Tabs defaultSelectedKey="coils" className="w-full">
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Register tables"
            className="flex flex-row w-full bg-muted/50 rounded-full p-1 gap-1"
          >
            <Tabs.Tab
              id="coils"
              className="flex-1 justify-center text-center rounded-full px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap text-text-muted data-[selected=true]:bg-surface data-[selected=true]:text-foreground data-[selected=true]:shadow-sm transition-all"
            >
              {t('tabs.coils')}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab
              id="discrete"
              className="flex-1 justify-center text-center rounded-full px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap text-text-muted data-[selected=true]:bg-surface data-[selected=true]:text-foreground data-[selected=true]:shadow-sm transition-all"
            >
              {t('tabs.discreteInputs')}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab
              id="holding"
              className="flex-1 justify-center text-center rounded-full px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap text-text-muted data-[selected=true]:bg-surface data-[selected=true]:text-foreground data-[selected=true]:shadow-sm transition-all"
            >
              {t('tabs.holdingRegisters')}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab
              id="input"
              className="flex-1 justify-center text-center rounded-full px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap text-text-muted data-[selected=true]:bg-surface data-[selected=true]:text-foreground data-[selected=true]:shadow-sm transition-all"
            >
              {t('tabs.inputRegisters')}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="coils" className="animate-fade-in">
          <RegisterTable
            title={t('tabs.coils')}
            type="coil"
            data={state.coils}
            writable
            onWrite={(addr, val) => writeRegister('coil', addr, val)}
          />
        </Tabs.Panel>
        <Tabs.Panel id="discrete" className="animate-fade-in">
          <RegisterTable
            title={t('tabs.discreteInputs')}
            type="discreteInput"
            data={state.discreteInputs}
            writable
            onWrite={(addr, val) => writeRegister('discreteInput', addr, val)}
          />
        </Tabs.Panel>
        <Tabs.Panel id="holding" className="animate-fade-in">
          <RegisterTable
            title={t('tabs.holdingRegisters')}
            type="holdingRegister"
            data={state.holdingRegisters}
            writable
            onWrite={(addr, val) => writeRegister('holdingRegister', addr, val)}
          />
        </Tabs.Panel>
        <Tabs.Panel id="input" className="animate-fade-in">
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
  );
}
