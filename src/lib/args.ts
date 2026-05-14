export interface ParsedArgs {
  /** HTTP server port (Next.js). */
  port: string | null
  /** Modbus TCP listening port. */
  tcpPort: string | null
  /** Modbus RTU serial port path. */
  serialPort: string | null
  /** Whether to show help and exit. */
  help: boolean
}

/**
 * Parse CLI arguments for the Modbus Simulator entry scripts.
 * Supports both short (-p, -t, -s, -h) and long (--port, --tcp-port,
 * --serial-port, --help) forms, as well as --key=value syntax.
 *
 * Unknown arguments are ignored so that callers can decide how to handle them.
 */
export function parseCliArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = { port: null, tcpPort: null, serialPort: null, help: false }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '-p' || arg === '--port') {
      args.port = argv[++i] ?? null
    } else if (arg.startsWith('--port=')) {
      args.port = arg.slice(7) || null
    } else if (arg === '-t' || arg === '--tcp-port') {
      args.tcpPort = argv[++i] ?? null
    } else if (arg.startsWith('--tcp-port=')) {
      args.tcpPort = arg.slice(11) || null
    } else if (arg === '-s' || arg === '--serial-port') {
      args.serialPort = argv[++i] ?? null
    } else if (arg.startsWith('--serial-port=')) {
      args.serialPort = arg.slice(14) || null
    } else if (arg === '-h' || arg === '--help') {
      args.help = true
    }
  }

  return args
}

const HELP_TEXT = `
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
`

/** Returns the standard help text for entry scripts. */
export function getHelpText(): string {
  return HELP_TEXT.trim()
}
