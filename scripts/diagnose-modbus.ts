import { createConnection } from 'net';
import ModbusRTU from 'modbus-serial';

/** ANSI color codes for terminal output. */
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

/** Simple test result tracker. */
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ${GREEN}PASS${RESET} ${name}`);
  } catch (e) {
    const error = (e as Error).message || String(e);
    results.push({ name, passed: false, error });
    console.log(`  ${RED}FAIL${RESET} ${name}`);
    console.log(`      ${RED}→ ${error}${RESET}`);
  }
}

/** Check whether a TCP port is accepting connections (no HTTP involved). */
function isPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection(port, host);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.setTimeout(2000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/** Run all TCP diagnostic tests against localhost:502. */
async function diagnoseTCP(host = 'localhost', port = 502): Promise<void> {
  console.log(`\n${CYAN}═══ TCP Diagnostics (${host}:${port}) ═══${RESET}\n`);

  // 1. Verify the raw TCP port is open BEFORE making any HTTP request.
  await runTest('TCP port is listening (raw socket)', async () => {
    const open = await isPortOpen(host, port);
    if (!open) {
      throw new Error(
        `Port ${port} is not accepting connections. ` +
          `The Modbus TCP server may not have started yet. ` +
          `Try opening the web UI first (triggers lazy startup), ` +
          `or check if another process is using port ${port}.`
      );
    }
  });

  const client = new ModbusRTU();
  let connected = false;

  await runTest('TCP Modbus handshake', async () => {
    await client.connectTCP(host, { port });
    client.setID(1);
    connected = true;
  });

  if (!connected) {
    console.log(`\n${YELLOW}⚠ Modbus handshake failed — skipping remaining TCP tests${RESET}\n`);
    return;
  }

  // ── Single reads ──
  await runTest('read single coil (FC 01, qty=1)', async () => {
    const res = await client.readCoils(0, 1);
    if (!Array.isArray(res.data) || res.data.length < 1) {
      throw new Error(`Unexpected response: ${JSON.stringify(res.data)}`);
    }
  });

  await runTest('read single discrete input (FC 02, qty=1)', async () => {
    const res = await client.readDiscreteInputs(0, 1);
    if (!Array.isArray(res.data) || res.data.length < 1) {
      throw new Error(`Unexpected response: ${JSON.stringify(res.data)}`);
    }
  });

  await runTest('read single holding register (FC 03, qty=1)', async () => {
    const res = await client.readHoldingRegisters(0, 1);
    if (!Array.isArray(res.data) || res.data.length !== 1) {
      throw new Error(`Unexpected response: ${JSON.stringify(res.data)}`);
    }
  });

  await runTest('read single input register (FC 04, qty=1)', async () => {
    const res = await client.readInputRegisters(0, 1);
    if (!Array.isArray(res.data) || res.data.length !== 1) {
      throw new Error(`Unexpected response: ${JSON.stringify(res.data)}`);
    }
  });

  // ── Batch reads (the most common real-world pattern) ──
  await runTest('read multiple coils (FC 01, qty=10)', async () => {
    const res = await client.readCoils(0, 10);
    // Modbus returns whole bytes, so the array may be padded to a multiple of 8
    if (!Array.isArray(res.data) || res.data.length < 10) {
      throw new Error(`Expected ≥10 values, got ${res.data?.length}: ${JSON.stringify(res.data)}`);
    }
  });

  await runTest('read multiple discrete inputs (FC 02, qty=10)', async () => {
    const res = await client.readDiscreteInputs(0, 10);
    if (!Array.isArray(res.data) || res.data.length < 10) {
      throw new Error(`Expected ≥10 values, got ${res.data?.length}: ${JSON.stringify(res.data)}`);
    }
  });

  await runTest('read multiple holding registers (FC 03, qty=10)', async () => {
    const res = await client.readHoldingRegisters(0, 10);
    if (!Array.isArray(res.data) || res.data.length !== 10) {
      throw new Error(`Expected 10 values, got ${res.data?.length}: ${JSON.stringify(res.data)}`);
    }
  });

  await runTest('read multiple input registers (FC 04, qty=10)', async () => {
    const res = await client.readInputRegisters(0, 10);
    if (!Array.isArray(res.data) || res.data.length !== 10) {
      throw new Error(`Expected 10 values, got ${res.data?.length}: ${JSON.stringify(res.data)}`);
    }
  });

  // ── Single writes ──
  await runTest('write single coil (FC 05)', async () => {
    await client.writeCoil(0, true);
    const res = await client.readCoils(0, 1);
    if (res.data[0] !== true) {
      throw new Error(`Write did not persist: expected true, got ${res.data[0]}`);
    }
  });

  await runTest('write single holding register (FC 06)', async () => {
    await client.writeRegister(0, 0x1234);
    const res = await client.readHoldingRegisters(0, 1);
    if (res.data[0] !== 0x1234) {
      throw new Error(`Write did not persist: expected 4660, got ${res.data[0]}`);
    }
  });

  // ── Batch writes ──
  await runTest('write multiple coils (FC 0F)', async () => {
    await client.writeCoils(10, [true, false, true, true, false]);
    const res = await client.readCoils(10, 5);
    const expected = [true, false, true, true, false];
    for (let i = 0; i < expected.length; i++) {
      if (res.data[i] !== expected[i]) {
        throw new Error(`Index ${i}: expected ${expected[i]}, got ${res.data[i]}`);
      }
    }
  });

  await runTest('write multiple holding registers (FC 10)', async () => {
    await client.writeRegisters(10, [100, 200, 300, 400, 500]);
    const res = await client.readHoldingRegisters(10, 5);
    const expected = [100, 200, 300, 400, 500];
    for (let i = 0; i < expected.length; i++) {
      if (res.data[i] !== expected[i]) {
        throw new Error(`Index ${i}: expected ${expected[i]}, got ${res.data[i]}`);
      }
    }
  });

  // ── Error handling ──
  // Use address 60000 (valid 16-bit Modbus address, but exceeds engine's 10000 registers)
  await runTest('out-of-range read returns Modbus exception', async () => {
    try {
      await client.readHoldingRegisters(60000, 1);
      throw new Error('Expected an exception response, but request succeeded');
    } catch (err) {
      const msg = (err as Error).message;
      if (!msg.includes('exception') && !msg.includes('Exception')) {
        throw new Error(`Unexpected error type: ${msg}`, { cause: err });
      }
    }
  });

  client.close(() => {
    // closed
  });
}

/** Print final summary report. */
function printSummary(): void {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n${CYAN}═══ Summary ═══${RESET}\n`);
  console.log(`  Total : ${results.length}`);
  console.log(`  ${GREEN}Passed: ${passed}${RESET}`);
  console.log(`  ${RED}Failed: ${failed}${RESET}`);

  if (failed > 0) {
    console.log(`\n${YELLOW}⚠ 问题诊断:${RESET}\n`);

    const connFailure = results.find(
      (r) => r.name === 'TCP port is listening (raw socket)' && !r.passed
    );
    if (connFailure) {
      console.log(`  ${YELLOW}1. TCP Server 延迟启动（最可能的原因）${RESET}`);
      console.log(
        `     Modbus TCP 服务器只在第一个 HTTP API 请求到达时才启动（Next.js 按需加载机制）。`
      );
      console.log(
        `     如果用户直接运行 'npm run dev' 后立即用 Modbus 软件连接，端口 502 还未监听。`
      );
      console.log(`     修复方案：在 Next.js instrumentation 钩子中立即启动服务器。\n`);
    }

    const batchReadFailures = results.filter(
      (r) =>
        !r.passed &&
        (r.name.includes('multiple') || r.name.includes('qty=10')) &&
        !r.name.includes('write')
    );
    if (batchReadFailures.length > 0) {
      console.log(`  ${YELLOW}2. TCP Server 缺少批量读取回调${RESET}`);
      console.log(
        `     ServerTCP vector 未注册 getCoils/getHoldingRegisters/getInputRegisters/getDiscreteInputs，`
      );
      console.log(`     导致批量读取请求失败。\n`);
    }

    const batchWriteFailures = results.filter(
      (r) => !r.passed && r.name.includes('multiple') && r.name.includes('write')
    );
    if (batchWriteFailures.length > 0) {
      console.log(`  ${YELLOW}3. Server 缺少批量写入支持${RESET}`);
      console.log(
        `     功能码 0x0F (Write Multiple Coils) 和 0x10 (Write Multiple Registers) 未正确实现。\n`
      );
    }

    console.log(`${RED}请根据上述诊断结果修复服务器代码后重新运行本脚本。${RESET}\n`);
    process.exitCode = 1;
  } else {
    console.log(`\n${GREEN}所有测试通过！外部 Modbus 客户端应可正常连接。${RESET}\n`);
    process.exitCode = 0;
  }
}

/** Main entry. */
async function main(): Promise<void> {
  const host = process.argv[2] || 'localhost';
  const port = Number(process.argv[3]) || 502;

  console.log(`\n${CYAN}Modbus Simulator Diagnostic Tool${RESET}`);
  console.log(`Target: ${host}:${port}`);

  try {
    await diagnoseTCP(host, port);
  } catch (e) {
    console.error(`${RED}Unexpected error during diagnosis:${RESET}`, e);
  }

  printSummary();
}

void main();
