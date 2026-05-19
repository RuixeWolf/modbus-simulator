'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input, Pagination, Table } from '@heroui/react'

/** Props for {@link RegisterTable}. */
interface RegisterTableProps {
  /** Accessible label for the table (used for aria-label). */
  title: string
  /** Register category rendered by this table. */
  type: 'coil' | 'holdingRegister' | 'inputRegister' | 'discreteInput'
  /** Full register array; only a single page is rendered at a time. */
  data: boolean[] | number[]
  /** When true the last column shows write controls. */
  writable?: boolean
  /** Callback fired when the user submits a new value. */
  onWrite?: (address: number, value: number | boolean) => void
}

/** Number of rows shown per page. */
const PAGE_SIZE = 20

/**
 * Generate page numbers with ellipsis for pagination.
 * Shows first, last, current, and neighbors; ellipsis for gaps.
 */
function getPageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: (number | 'ellipsis')[] = []
  pages.push(1)

  if (page > 3) {
    pages.push('ellipsis')
  }

  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (page < totalPages - 2) {
    pages.push('ellipsis')
  }

  pages.push(totalPages)
  return pages
}

function resolveTargetPage(
  rawAddress: string,
  totalPages: number,
  dataLength: number
): number | null {
  const addr = Number.parseInt(rawAddress, 10)
  if (Number.isNaN(addr) || addr < 0 || addr >= dataLength) return null

  const targetPage = Math.floor(addr / PAGE_SIZE) + 1
  return Math.min(totalPages, targetPage)
}

/**
 * Paginated table for displaying and optionally editing Modbus registers.
 *
 * @returns HeroUI Table with pagination.
 */
export function RegisterTable({
  title,
  type,
  data,
  writable = false,
  onWrite
}: Readonly<RegisterTableProps>) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  /** Staging values for holding-register inputs, keyed by address. */
  const [editValue, setEditValue] = useState<Record<number, string>>({})
  /** Staging value for the goto-address input. */
  const [gotoAddr, setGotoAddr] = useState('')

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE))
  const startAddr = (page - 1) * PAGE_SIZE
  const displayData = data.slice(startAddr, startAddr + PAGE_SIZE)
  const pageNumbers = useMemo(() => getPageNumbers(page, totalPages), [page, totalPages])

  const startItem = startAddr + 1
  const endItem = Math.min(page * PAGE_SIZE, data.length)

  const handleCoilToggle = (address: number, value: boolean) => {
    onWrite?.(address, !value)
  }

  const handleRegisterSubmit = (address: number) => {
    const val = Number.parseInt(editValue[address] || '0', 10)
    if (!Number.isNaN(val)) {
      onWrite?.(address, val & 0xffff)
    }
    setEditValue((prev) => ({ ...prev, [address]: '' }))
  }

  const columns = [
    { id: 'address', name: t('registerTable.address') },
    { id: 'value', name: t('registerTable.value') },
    ...(writable ? [{ id: 'action', name: t('registerTable.action') }] : [])
  ]

  let ellipsisCount = 0
  const paginationItems = pageNumbers.map((p) =>
    p === 'ellipsis' ? (
      <Pagination.Item key={`ellipsis-${++ellipsisCount}`}>
        <Pagination.Ellipsis />
      </Pagination.Item>
    ) : (
      <Pagination.Item key={p}>
        <Pagination.Link
          isActive={p === page}
          onPress={() => {
            setPage(p)
          }}
        >
          {p}
        </Pagination.Link>
      </Pagination.Item>
    )
  )

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <div className="flex justify-between items-center px-1">
          <div className="px-2 text-xl font-bold">{title}</div>
          <div className="flex items-center justify-end gap-2 px-1 py-2">
            <Input
              type="number"
              placeholder={t('registerTable.gotoAddress')}
              value={gotoAddr}
              onChange={(e) => {
                setGotoAddr(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const targetPage = resolveTargetPage(gotoAddr, totalPages, data.length)
                  if (targetPage !== null) {
                    setPage(targetPage)
                  }
                  setGotoAddr('')
                }
              }}
              className="w-40"
            />
            <Button
              size="sm"
              onPress={() => {
                const targetPage = resolveTargetPage(gotoAddr, totalPages, data.length)
                if (targetPage !== null) {
                  setPage(targetPage)
                }
                setGotoAddr('')
              }}
            >
              {t('registerTable.goto')}
            </Button>
          </div>
        </div>
        <Table.ScrollContainer>
          <Table.Content aria-label={title} className="min-w-125" data-testid={`table-${type}`}>
            <Table.Header columns={columns}>
              {(column) => (
                <Table.Column
                  id={column.id}
                  isRowHeader={column.id === 'address'}
                  className="font-mono text-[11px] font-semibold tracking-wider uppercase"
                >
                  {column.name}
                </Table.Column>
              )}
            </Table.Header>
            <Table.Body
              renderEmptyState={() => (
                <div className="text-text-muted flex h-32 items-center justify-center italic">
                  {t('registerTable.noData')}
                </div>
              )}
            >
              {displayData.map((value, idx) => {
                const address = startAddr + idx
                return (
                  <Table.Row
                    key={address}
                    id={String(address)}
                    data-testid={`row-${type}-${address}`}
                  >
                    <Table.Cell className="font-mono text-xs">{address}</Table.Cell>
                    <Table.Cell className="font-mono text-xs">
                      {typeof value === 'boolean' ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                            value
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-default text-text-muted'
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
                    </Table.Cell>
                    {writable && (
                      <Table.Cell>
                        {type === 'coil' ? (
                          <Button
                            size="sm"
                            variant={value ? 'primary' : 'ghost'}
                            onPress={() => {
                              handleCoilToggle(address, value as boolean)
                            }}
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
                                  [address]: e.target.value
                                }))
                              }
                              className="w-24"
                              data-testid={`register-input-${address}`}
                            />
                            <Button
                              size="sm"
                              onPress={() => {
                                handleRegisterSubmit(address)
                              }}
                              data-testid={`register-submit-${address}`}
                            >
                              {t('registerTable.set')}
                            </Button>
                          </div>
                        )}
                      </Table.Cell>
                    )}
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
        <Table.Footer>
          <Pagination size="sm" className="w-full">
            <Pagination.Summary>
              {startItem}-{endItem} / {data.length}
            </Pagination.Summary>
            <Pagination.Content className="flex-wrap justify-center">
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={page === 1}
                  onPress={() => {
                    setPage((p) => Math.max(1, p - 1))
                  }}
                >
                  <Pagination.PreviousIcon />
                  {t('registerTable.prev')}
                </Pagination.Previous>
              </Pagination.Item>
              {paginationItems}
              <Pagination.Item>
                <Pagination.Next
                  isDisabled={page === totalPages}
                  onPress={() => {
                    setPage((p) => Math.min(totalPages, p + 1))
                  }}
                >
                  {t('registerTable.next')}
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </Table.Footer>
      </Table>
    </div>
  )
}
