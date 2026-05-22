'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DataType } from '@/src/lib/modbus/buffer-convert'
import { getDataTypeSize } from '@/src/lib/modbus/buffer-convert'
import { Button, Input, Label, ListBox, Modal, Select, Tabs } from '@heroui/react'

const DATA_TYPES: DataType[] = [
  'UInt8',
  'UInt16BE',
  'UInt16LE',
  'UInt32BE',
  'UInt32LE',
  'UIntBE',
  'UIntLE',
  'Int8',
  'Int16BE',
  'Int16LE',
  'Int32BE',
  'Int32LE',
  'IntBE',
  'IntLE',
  'FloatBE',
  'FloatLE',
  'Float1234',
  'Float2143',
  'Float3412',
  'Float4321',
  'DoubleBE',
  'DoubleLE'
]

interface AdvancedWriteModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  registerType: 'holdingRegister' | 'inputRegister'
  onSubmit: (payload: {
    registerType: string
    startAddress: number
    mode: 'number' | 'bytes'
    dataType?: string
    value?: number
    hexString?: string
  }) => Promise<void>
}

export function AdvancedWriteModal({
  isOpen,
  onOpenChange,
  registerType,
  onSubmit
}: Readonly<AdvancedWriteModalProps>) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'number' | 'bytes'>('number')
  const [startAddress, setStartAddress] = useState('')
  const [dataType, setDataType] = useState<DataType>('UInt16BE')
  const [value, setValue] = useState('')
  const [hexString, setHexString] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const registerCount = useMemo(() => {
    if (mode === 'number') {
      return Math.ceil(getDataTypeSize(dataType) / 2)
    }
    const cleaned = hexString.replace(/0x/gi, '').replace(/[,\s]/g, '').trim()
    const count = Math.ceil(cleaned.length / 4)
    return count > 0 ? count : 1
  }, [mode, dataType, hexString])

  const handleSubmit = async () => {
    const addr = Number.parseInt(startAddress, 10)
    if (Number.isNaN(addr) || addr < 0 || addr >= 10000) {
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'number') {
        const numVal = Number.parseFloat(value)
        if (Number.isNaN(numVal)) return
        await onSubmit({
          registerType,
          startAddress: addr,
          mode: 'number',
          dataType,
          value: numVal
        })
      } else {
        await onSubmit({
          registerType,
          startAddress: addr,
          mode: 'bytes',
          hexString
        })
      }
      onOpenChange(false)
      setStartAddress('')
      setValue('')
      setHexString('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className="border-b">
              <Modal.Heading>{t('registerTable.advancedWriteTitle')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4 px-4 py-4">
              <div>
                <Label className="mb-1 block text-sm font-medium">
                  {t('registerTable.startAddress')}
                </Label>
                <Input
                  type="number"
                  value={startAddress}
                  onChange={(e) => setStartAddress(e.target.value)}
                  min={0}
                  max={9999}
                  className="w-full"
                />
              </div>

              <Tabs defaultSelectedKey="number">
                <Tabs.ListContainer>
                  <Tabs.List aria-label={t('registerTable.advancedWriteTitle')}>
                    <Tabs.Tab id="number" onPress={() => setMode('number')}>
                      {t('registerTable.modeNumber')}
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="bytes" onPress={() => setMode('bytes')}>
                      {t('registerTable.modeBytes')}
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>

                <Tabs.Panel id="number" className="space-y-3 pt-3">
                  <Select
                    value={dataType}
                    onChange={(val) => {
                      const matched = DATA_TYPES.find((dt) => dt === val)
                      setDataType(matched ?? 'UInt16BE')
                    }}
                    className="w-full"
                  >
                    <Label className="mb-1 block text-sm font-medium">
                      {t('registerTable.dataType')}
                    </Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {DATA_TYPES.map((dt) => (
                          <ListBox.Item key={dt} id={dt} textValue={dt}>
                            {dt}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>

                  <div>
                    <Label className="mb-1 block text-sm font-medium">
                      {t('registerTable.value')}
                    </Label>
                    <Input
                      type="text"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </Tabs.Panel>

                <Tabs.Panel id="bytes" className="space-y-3 pt-3">
                  <div>
                    <Label className="mb-1 block text-sm font-medium">
                      {t('registerTable.hexString')}
                    </Label>
                    <Input
                      type="text"
                      placeholder="0A 45 B1 30"
                      value={hexString}
                      onChange={(e) => setHexString(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </Tabs.Panel>
              </Tabs>

              <p className="text-text-muted text-sm">
                {t('registerTable.registersToWrite', { count: registerCount })}
              </p>
            </Modal.Body>
            <Modal.Footer className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onPress={handleSubmit}
                isDisabled={isSubmitting || !startAddress}
              >
                {t('registerTable.submit')}
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
