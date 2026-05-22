'use client'

import { useTranslation } from 'react-i18next'
import type { TcpClientInfo } from '@/src/hooks/useModbusData'
import { Button, Modal, ScrollShadow } from '@heroui/react'

/** Props for {@link TcpClientPanel}. */
interface TcpClientPanelProps {
  /** Currently connected TCP clients. */
  clients: TcpClientInfo[]
  /** Whether the modal is currently open. */
  isOpen: boolean
  /** Called when the open state changes (e.g. user closes the modal). */
  onOpenChange: (open: boolean) => void
  /** Called when the user requests to disconnect a single client. */
  onDisconnect: (id: number) => void | Promise<void>
  /** Called when the user requests to disconnect all clients. */
  onDisconnectAll: () => void | Promise<void>
}

/**
 * TCP client connection management dialog.
 *
 * @returns A modal dialog that displays active TCP connections and allows
 *          forcibly disconnecting individual or all clients.
 */
export function TcpClientPanel({
  clients,
  isOpen,
  onOpenChange,
  onDisconnect,
  onDisconnectAll
}: Readonly<TcpClientPanelProps>) {
  const { t } = useTranslation()

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="sm:max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header className="border-b">
              <Modal.Heading>{t('tcpClients.title')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-0">
              <ScrollShadow className="max-h-[60vh] w-full">
                <div className="w-full text-sm" data-testid="tcp-client-panel">
                  {clients.length === 0 ? (
                    <div className="text-text-muted flex h-32 items-center justify-center italic">
                      {t('tcpClients.noClients')}
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-default/50 text-text-muted sticky top-0 text-left text-xs uppercase">
                        <tr>
                          <th className="px-5 py-2 font-medium">{t('tcpClients.host')}</th>
                          <th className="px-5 py-2 font-medium">{t('tcpClients.port')}</th>
                          <th className="px-5 py-2 font-medium">{t('tcpClients.connectedAt')}</th>
                          <th className="px-5 py-2 font-medium">{t('tcpClients.action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clients.map((client, i) => (
                          <tr key={client.id} className={i % 2 === 0 ? 'bg-default/20' : ''}>
                            <td className="px-5 py-2 font-mono">{client.host}</td>
                            <td className="px-5 py-2 font-mono">{client.port}</td>
                            <td className="px-5 py-2 text-text-muted">
                              {new Date(client.connectedAt).toLocaleString()}
                            </td>
                            <td className="px-5 py-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onPress={() => onDisconnect(client.id)}
                                data-testid={`disconnect-client-${client.id}`}
                              >
                                {t('tcpClients.disconnect')}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </ScrollShadow>
            </Modal.Body>
            <Modal.Footer className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onPress={onDisconnectAll}
                isDisabled={clients.length === 0}
                data-testid="disconnect-all-clients"
              >
                {t('tcpClients.disconnectAll')}
              </Button>
              <Button slot="close" variant="secondary" className="flex-1">
                {t('common.close')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
