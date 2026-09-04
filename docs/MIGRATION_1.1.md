# Migrating to 1.1.0

Version 1.1.0 replaces the unversioned HTTP routes with the strict `/api/v1` control contract. There are no compatibility aliases: update callers before upgrading.

## Endpoint mapping

| Before 1.1                  | 1.1.0 replacement                                            |
| --------------------------- | ------------------------------------------------------------ |
| `GET /api/status`           | `GET /api/v1/health`                                         |
| `GET /api/registers`        | `GET /api/v1/state`                                          |
| `POST /api/registers`       | `PUT /api/v1/registers/{table}` with `{ "start", "values" }` |
| `POST /api/registers/batch` | `PUT /api/v1/registers/{table}/encoded`                      |
| `GET /api/config`           | `GET /api/v1/config`                                         |
| `POST /api/config`          | `PATCH /api/v1/config`                                       |
| `GET /api/logs`             | `GET /api/v1/logs`                                           |
| `DELETE /api/logs`          | `DELETE /api/v1/logs`                                        |
| `GET /api/serial-ports`     | `GET /api/v1/serial-ports`                                   |
| `GET /api/tcp-clients`      | `GET /api/v1/tcp-clients`                                    |
| `GET /api/tcp-clients/{id}` | `GET /api/v1/tcp-clients/{id}`                               |

The `{table}` value is one of `coils`, `discrete-inputs`, `holding-registers`, or `input-registers`. HTTP control writes may intentionally update all four simulator tables; Modbus protocol clients retain the normal read-only restrictions for discrete inputs and input registers.

## Response envelopes and validation

Successful JSON responses now use:

```json
{ "data": {}, "meta": { "apiVersion": "1", "instanceId": "..." } }
```

Failures use a stable error envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "issues": [{ "path": "values.0", "message": "Invalid input" }]
  },
  "meta": { "apiVersion": "1", "instanceId": "..." }
}
```

Malformed JSON returns HTTP 400. Strict schema failures return HTTP 422, including unknown fields. Missing or incorrect credentials return 401, unknown resources return 404, lifecycle conflicts return 409, and unavailable transports return 503. Register addresses are 0-based, range operations are limited to 1,000 values, values must already have the correct boolean or unsigned 16-bit integer type, and the complete write is rejected before mutation if any element is invalid.

Use `GET /api/v1/openapi.json` as the machine-readable source of truth.

## Listener and authentication changes

Both HTTP and Modbus TCP now bind to `127.0.0.1` by default. A non-loopback HTTP bind is rejected unless a Token is supplied with `MODBUS_API_TOKEN` or `--api-token-file`. Protected requests must include:

```text
Authorization: Bearer <token>
```

The Dashboard validates the Token with the health endpoint and stores it only in browser `sessionStorage`. Tokens are never accepted in URLs or emitted in readiness/error records. Browser cross-origin requests are rejected; configure an authenticated same-origin reverse proxy when remote browser access is required.

## Lifecycle and readiness changes

Configuration updates are now `PATCH` operations. Only affected transports restart, active TCP clients are disconnected when TCP restarts, and the response reports explicit effects. Desired configuration remains visible if a bind or serial-open operation fails, while actual lifecycle state reports the error.

For automation, wait for the health-based readiness record rather than treating process spawn as ready:

```bash
npx --yes @ruixe/modbus-simulator@latest --host 127.0.0.1 --port 15000 --tcp-host 127.0.0.1 --tcp-port 15020 --ready-output json --ready-timeout 30 --strict-ready
```

`--strict-ready` terminates only the child process it started and returns nonzero on timeout or degraded health. Without it, the process remains available in degraded mode so the Dashboard and diagnostics can be used.

See [`skills/modbus-simulator/SKILL.md`](../skills/modbus-simulator/SKILL.md) for the complete owned-process agent workflow and helper commands.
