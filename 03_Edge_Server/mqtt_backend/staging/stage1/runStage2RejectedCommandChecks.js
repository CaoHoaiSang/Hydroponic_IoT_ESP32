const fs = require('node:fs');
const path = require('node:path');

const mqtt = require('mqtt');
const { MongoClient } = require('mongodb');

const runtimeRoot = path.join(__dirname, '.stage1_runtime');
const secretsRoot = path.join(runtimeRoot, 'secrets');
const commandTopic = 'stage1/hydroponic/device001/pump/cmd';
const statusTopic = 'stage1/hydroponic/device001/pump/status';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function connect(url, credentials) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(url, {
      username: credentials.username,
      password: credentials.password,
      reconnectPeriod: 0,
      connectTimeout: 3000,
    });
    client.once('connect', () => resolve(client));
    client.once('error', reject);
  });
}

function close(client) {
  return new Promise((resolve) => client.end(true, resolve));
}

async function main() {
  const verification = readJson(path.join(secretsRoot, 'stage2-firmware-verified.json'));
  if (verification.profile !== 'USB_STAGE2_MAIN_PUMP' || Date.parse(verification.expiresAtUtc) <= Date.now()) {
    throw new Error('Verified Stage 2 firmware marker is invalid or expired.');
  }
  const state = readJson(path.join(runtimeRoot, 'processes.json'));
  const credentials = readJson(path.join(secretsRoot, 'credentials.json'));
  if (state.Stage2MainPumpOperatorPrepared !== true || !credentials.operator) {
    throw new Error('Stage 2 operator runtime is not prepared.');
  }

  const prefix = `stage2_reject_${Date.now()}`;
  const commands = [
    { commandId: `${prefix}_set`, deviceId: 'device001', pump: 'main', action: 'set', state: 'on', source: 'stage2_negative_test' },
    { commandId: `${prefix}_a`, deviceId: 'device001', pump: 'A', action: 'pulse', durationMs: 1000, source: 'stage2_negative_test' },
    { commandId: `${prefix}_b`, deviceId: 'device001', pump: 'B', action: 'pulse', durationMs: 1000, source: 'stage2_negative_test' },
    { commandId: `${prefix}_long`, deviceId: 'device001', pump: 'main', action: 'pulse', durationMs: 3001, source: 'stage2_negative_test' },
  ];
  const expectedIds = new Set(commands.map((command) => command.commandId));
  const statuses = new Map();
  let auditor;
  let operator;
  try {
    auditor = await connect(state.MqttLoopbackUrl, credentials.auditor);
    operator = await connect(state.MqttLoopbackUrl, credentials.operator);
    await new Promise((resolve, reject) => auditor.subscribe(statusTopic, { qos: 1 }, (error) => (
      error ? reject(error) : resolve()
    )));

    const allRejected = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for rejected statuses.')), 12_000);
      auditor.on('message', (topic, message) => {
        if (topic !== statusTopic) return;
        let payload;
        try { payload = JSON.parse(message.toString()); } catch { return; }
        if (!expectedIds.has(payload.commandId)) return;
        statuses.set(payload.commandId, payload);
        if (statuses.size === commands.length) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    for (const command of commands) {
      await new Promise((resolve, reject) => operator.publish(
        commandTopic,
        JSON.stringify(command),
        { qos: 1 },
        (error) => (error ? reject(error) : resolve()),
      ));
    }
    await allRejected;

    const results = commands.map((command) => statuses.get(command.commandId));
    if (results.some((status) => !status || status.accepted !== false || status.status !== 'rejected')) {
      throw new Error('At least one forbidden command was not rejected.');
    }
    if (results.some((status) => ['started', 'completed', 'set_on'].includes(status.status))) {
      throw new Error('A forbidden command entered an actuator execution state.');
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
    const mongo = new MongoClient('mongodb://127.0.0.1:27019', { serverSelectionTimeoutMS: 3000 });
    try {
      await mongo.connect();
      const database = mongo.db('hydroponic_stage1_preflight');
      const [matchingLogs, dosingRuns] = await Promise.all([
        database.collection('pump_logs').countDocuments({ commandId: { $in: commands.map((row) => row.commandId) } }),
        database.collection('dosing_runs').countDocuments({}),
      ]);
      console.log(JSON.stringify({
        result: 'PASS',
        commandsSent: commands.length,
        rejected: results.length,
        executionStatuses: 0,
        matchingRejectedPumpLogs: matchingLogs,
        dosingRuns,
        messages: results.map((status) => status.message),
      }, null, 2));
      if (dosingRuns !== 0) throw new Error('A dosing run exists after negative command checks.');
    } finally {
      await mongo.close();
    }
  } finally {
    await Promise.all([
      auditor ? close(auditor) : Promise.resolve(),
      operator ? close(operator) : Promise.resolve(),
    ]);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ result: 'FAIL', error: error.message }, null, 2));
  process.exitCode = 1;
});
