'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, FieldError, Input, Label, Modal, TextField } from '@heroui/react'

interface TokenPromptProps {
  isOpen: boolean
  error: string | null
  isPending: boolean
  onSubmit: (token: string) => void | Promise<void>
}

export function TokenPrompt({ isOpen, error, isPending, onSubmit }: Readonly<TokenPromptProps>) {
  const { t } = useTranslation()
  const [token, setToken] = useState('')

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={() => undefined}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.Header>
              <Modal.Heading>{t('auth.title')}</Modal.Heading>
              <p className="text-text-muted mt-1 text-sm">{t('auth.description')}</p>
            </Modal.Header>
            <Modal.Body>
              <TextField isRequired isInvalid={Boolean(error)}>
                <Label>{t('auth.token')}</Label>
                <Input
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  autoComplete="off"
                  data-testid="api-token-input"
                />
                {error && <FieldError>{error}</FieldError>}
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button
                fullWidth
                isPending={isPending}
                isDisabled={!token.trim()}
                onPress={() => void onSubmit(token)}
                data-testid="api-token-submit"
              >
                {t('auth.connect')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
