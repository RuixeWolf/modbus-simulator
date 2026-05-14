'use client';

import { Input, Button, Card } from '@heroui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Props for {@link RegisterTable}. */
interface RegisterTableProps {
  /** Localised title shown in the card header. */
  title: string;
  /** Register category rendered by this table. */
  type: 'coil' | 'holdingRegister' | 'inputRegister' | 'discreteInput';
  /** Full register array; only a single page is rendered at a time. */
  data: boolean[] | number[];
  /** When true the last column shows write controls. */
  writable?: boolean;
  /** Callback fired when the user submits a new value. */
  onWrite?: (address: number, value: number | boolean) => void;
}

/** Number of rows shown per page. */
const PAGE_SIZE = 20;

/**
 * Paginated table for displaying and optionally editing Modbus registers.
 *
 * @returns HeroUI Card containing the paginated table.
 */
export function RegisterTable({
  title,
  type,
  data,
  writable = false,
  onWrite,
}: Readonly<RegisterTableProps>) {
  const { t } = useTranslation();
  const [startAddr, setStartAddr] = useState(0);
  /** Staging values for holding-register inputs, keyed by address. */
  const [editValue, setEditValue] = useState<Record<number, string>>({});

  const displayData = data.slice(startAddr, startAddr + PAGE_SIZE);

  const handleCoilToggle = (address: number, value: boolean) => {
    onWrite?.(address, !value);
  };

  const handleRegisterSubmit = (address: number) => {
    const val = Number.parseInt(editValue[address] || '0', 10);
    if (!Number.isNaN(val)) {
      onWrite?.(address, val & 0xffff);
    }
    setEditValue((prev) => ({ ...prev, [address]: '' }));
  };

  return (
    <Card className="w-full rounded-2xl shadow-lg shadow-black/5 bg-surface border border-border/40">
      <Card.Header className="px-5 py-4">
        <div className="flex items-center justify-between w-full">
          <h2 className="text-base font-semibold">{title}</h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              isDisabled={startAddr === 0}
              onPress={() => setStartAddr((s) => Math.max(0, s - PAGE_SIZE))}
            >
              {t('registerTable.prev')}
            </Button>
            <span className="text-sm text-text-muted bg-muted px-3 py-1 rounded-full font-mono ">
              {t('registerTable.range', {
                start: startAddr,
                end: Math.min(startAddr + PAGE_SIZE, data.length),
              })}
            </span>
            <Button
              size="sm"
              variant="ghost"
              isDisabled={startAddr + PAGE_SIZE >= data.length}
              onPress={() => setStartAddr((s) => Math.min(data.length - PAGE_SIZE, s + PAGE_SIZE))}
            >
              {t('registerTable.next')}
            </Button>
          </div>
        </div>
      </Card.Header>
      <Card.Content className="p-0! overflow-x-auto">
        <table className="w-full text-sm" data-testid={`table-${type}`}>
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-text-muted uppercase tracking-wider font-mono rounded-tl-lg">
                {t('registerTable.address')}
              </th>
              <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-text-muted uppercase tracking-wider font-mono">
                {t('registerTable.value')}
              </th>
              {writable && (
                <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-text-muted uppercase tracking-wider font-mono rounded-tr-lg">
                  {t('registerTable.action')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {displayData.length === 0 && (
              <tr>
                <td colSpan={writable ? 3 : 2} className="py-8 text-center text-text-muted italic">
                  {t('registerTable.noData')}
                </td>
              </tr>
            )}
            {displayData.map((value, idx) => {
              const address = startAddr + idx;
              return (
                <tr
                  key={address}
                  className={`hover:bg-muted/30 transition-colors ${
                    idx % 2 === 0 ? '' : 'bg-muted/20'
                  }`}
                  data-testid={`row-${type}-${address}`}
                >
                  <td className="py-2.5 px-5 font-mono text-xs text-text-muted">{address}</td>
                  <td className="py-2.5 px-5 font-mono text-xs">
                    {typeof value === 'boolean' ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          value
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-muted text-text-muted'
                        }`}
                      >
                        {value ? 'TRUE' : 'FALSE'}
                      </span>
                    ) : (
                      <span className="text-foreground">
                        {value}{' '}
                        <span className="text-text-muted">
                          (0x{value.toString(16).padStart(4, '0')})
                        </span>
                      </span>
                    )}
                  </td>
                  {writable && (
                    <td className="py-2.5 px-5">
                      {type === 'coil' ? (
                        <Button
                          size="sm"
                          variant={value ? 'primary' : 'ghost'}
                          onPress={() => handleCoilToggle(address, value as boolean)}
                          data-testid={`coil-switch-${address}`}
                        >
                          {value ? 'ON' : 'OFF'}
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder={String(value)}
                            value={editValue[address] || ''}
                            onChange={(e) =>
                              setEditValue((prev) => ({
                                ...prev,
                                [address]: e.target.value,
                              }))
                            }
                            className="w-24"
                            data-testid={`register-input-${address}`}
                          />
                          <Button
                            size="sm"
                            onPress={() => handleRegisterSubmit(address)}
                            data-testid={`register-submit-${address}`}
                          >
                            {t('registerTable.set')}
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card.Content>
    </Card>
  );
}
