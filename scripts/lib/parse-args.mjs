import { parseArgs as nodeParseArgs } from 'node:util'

/** @typedef {{ port: string | null, tcpPort: string | null, serialPort: string | null, slaveId: string | null, open: boolean, help: boolean }} ParsedArgs */

const OPTIONS = {
  port: { type: 'string', short: 'p' },
  'tcp-port': { type: 'string', short: 't' },
  'serial-port': { type: 'string', short: 's' },
  'slave-id': { type: 'string', short: 'i' },
  open: { type: 'boolean', short: 'o' },
  help: { type: 'boolean', short: 'h' }
}

/** @returns {ParsedArgs} */
export function parseArgs(argv) {
  const { values } = nodeParseArgs({
    args: argv,
    options: OPTIONS,
    strict: false,
    allowPositionals: false
  })

  return {
    port: values.port || null,
    tcpPort: values['tcp-port'] || null,
    serialPort: values['serial-port'] || null,
    slaveId: values['slave-id'] || null,
    open: values.open || false,
    help: values.help || false
  }
}

export const HELP_TEXT = `
Usage: node <script> [options]

Options:
  -p, --port <number>        HTTP server port (default: 5000)
  -t, --tcp-port <number>    Modbus TCP listening port (default: 502)
  -s, --serial-port <path>   Modbus RTU serial port (e.g., COM1, /dev/ttyUSB0)
  -i, --slave-id <number>    Modbus device slave ID (default: 1, range: 1-247)
  -o, --open                 Open browser automatically after startup
  -h, --help                 Show this help message

Examples:
  node cli.mjs
  node cli.mjs -p 8080 -t 5020 -s COM3 -i 10
  node dev.mjs --port=8080 --tcp-port=5020 --open
`.trim()
