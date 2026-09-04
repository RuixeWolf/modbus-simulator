import '@/src/i18n'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StatusIndicator } from './StatusIndicator'

describe('StatusIndicator lifecycle rendering', () => {
  it.each([
    ['running', true],
    ['disabled', false],
    ['error', false]
  ] as const)('renders TCP %s state', (state, running) => {
    const html = renderToStaticMarkup(
      <StatusIndicator tcp={running} rtu={false} tcpState={state} rtuState="disabled" />
    )
    expect(html).toContain(`data-state="${state}"`)
  })
})
