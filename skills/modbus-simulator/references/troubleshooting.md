# Troubleshooting and deployment

- Inspect `health` first. Compare desired configuration with each transport's actual configuration, state, and error.
- Read cursor logs after the last observed ID. `droppedBeforeId` means older records were evicted.
- If HTTP `15000` or TCP `15020` is occupied, select another high-port pair. Do not kill an unknown listener.
- Windows serial paths look like `COM3`; Linux/macOS paths commonly look like `/dev/ttyUSB0`, `/dev/ttyACM0`, or `/dev/cu.usbserial-*`. Enumerate ports and use a real available path. Check permissions when RTU enters `error`.
- HTTP and Modbus TCP bind to `127.0.0.1` by default. For a LAN or container, explicitly set `--host`/`--tcp-host`; every non-loopback HTTP listener requires `MODBUS_API_TOKEN` or `--api-token-file`. Keep the listener behind a trusted network boundary.
- A strict-ready failure means the launcher cleaned up its own child. A non-strict launch may keep a degraded Dashboard available for diagnosis.
- Never print the Token, include it in URLs, store it in `localStorage`, or terminate a simulator process you did not start.
