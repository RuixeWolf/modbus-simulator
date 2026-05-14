/**
 * Shared CLI argument parser for Modbus Simulator entry scripts.
 * Supports short (-p, -t, -s, -h) and long (--port, --tcp-port,
 * --serial-port, --help) forms, as well as --key=value syntax.
 */

/** @typedef {{ port: string | null, tcpPort: string | null, serialPort: string | null, help: boolean }} ParsedArgs */

/** @returns {ParsedArgs} */
export function parseArgs(argv) {
  /** @type {ParsedArgs} */
  const result = { port: null, tcpPort: null, serialPort: null, help: false }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    switch (arg) {
      case '-p':
      case '--port':
        result.port = argv[++i] ?? null
        break
      case '-t':
      case '--tcp-port':
        result.tcpPort = argv[++i] ?? null
        break
      case '-s':
      case '--serial-port':
        result.serialPort = argv[++i] ?? null
        break
      case '-h':
      case '--help':
        result.help = true
        break
      default:
        if (arg.startsWith('--port=')) {
          result.port = arg.slice(7) || null
        } else if (arg.startsWith('--tcp-port=')) {
          result.tcpPort = arg.slice(11) || null
        } else if (arg.startsWith('--serial-port=')) {
          result.serialPort = arg.slice(14) || null
        }
    }
  }

  return result
}

export const HELP_TEXT = `
Usage: node <script> [options]

Options:
  -p, --port <number>        HTTP server port (default: 5000)
  -t, --tcp-port <number>    Modbus TCP listening port (default: 502)
  -s, --serial-port <path>   Modbus RTU serial port (e.g., COM1, /dev/ttyUSB0)
  -h, --help                 Show this help message

Examples:
  node start.mjs
  node start.mjs -p 8080 -t 5020 -s COM3
  node dev.mjs --port=8080 --tcp-port=5020
`.trim()
