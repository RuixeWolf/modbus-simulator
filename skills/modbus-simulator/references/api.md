# Control API and helper

The helper requires Node.js 20 and has no package dependencies. It prints JSON on success.

```sh
node scripts/control.mjs health --base-url http://127.0.0.1:15000
node scripts/control.mjs reset --clear-logs
node scripts/control.mjs read --table holding-registers --start 0 --count 10
node scripts/control.mjs write --table coils --start 0 --values '[true,false]'
node scripts/control.mjs write-encoded --table holding-registers --address 0 --data-type Float3412 --value 12.5
node scripts/control.mjs write-encoded --table input-registers --address 10 --bytes '12 34 AB CD'
node scripts/control.mjs config --json '{"slaveId":5}'
node scripts/control.mjs logs --after-id 0 --limit 100 --source api
```

Set `MODBUS_SIMULATOR_URL` to avoid repeating `--base-url`. Set `MODBUS_API_TOKEN` to add `Authorization: Bearer` without placing the Token in a URL or command argument.

| Method     | Path                                | Purpose                                      |
| ---------- | ----------------------------------- | -------------------------------------------- |
| GET        | `/api/v1`                           | Public discovery                             |
| GET        | `/api/v1/openapi.json`              | Public OpenAPI 3.1 document                  |
| GET        | `/api/v1/health`                    | Readiness and desired/actual transport state |
| GET        | `/api/v1/state`                     | Full Dashboard snapshot                      |
| POST       | `/api/v1/state/reset`               | Selective or full reset                      |
| GET/PUT    | `/api/v1/registers/{table}`         | Range read/write                             |
| PUT        | `/api/v1/registers/{table}/encoded` | Typed or byte write                          |
| GET/PATCH  | `/api/v1/config`                    | Desired config and serialized apply          |
| GET/DELETE | `/api/v1/logs`                      | Cursor logs and clear                        |
| GET        | `/api/v1/serial-ports`              | Serial enumeration                           |
| GET/DELETE | `/api/v1/tcp-clients`               | Inspect/disconnect clients                   |
| DELETE     | `/api/v1/tcp-clients/{id}`          | Disconnect one client                        |

Successful API responses use `{ "data": ..., "meta": { "apiVersion": "1", "instanceId": "..." } }`. Failures use `{ "error": { "code": "...", "message": "...", "issues": [...] }, "meta": ... }`.
